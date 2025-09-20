(function(){
  function normalizeFace(face){
    if(!face) return null;
    const text = typeof face.text === 'string' ? face.text : '';
    const url = face.url || face.imageUrl || null;
    return { text, url };
  }

  function renderFace(face){
    const normalized = normalizeFace(face);
    const wrap = document.createElement('div');
    wrap.className = 'learn-face-content';

    if(!normalized || (!normalized.text && !normalized.url)){
      wrap.textContent = 'Keine Inhalte.';
      return wrap;
    }

    if(normalized.text){
      const textEl = document.createElement('div');
      textEl.className = 'learn-face-text';
      textEl.textContent = normalized.text;
      wrap.appendChild(textEl);
    }

    if(normalized.url){
      const img = document.createElement('img');
      img.src = normalized.url;
      wrap.appendChild(img);
    }

    return wrap;
  }

  async function applyLearnOutcome(deckId, card, outcome, group, subsectionId=null){
    const result = { moved: false, goodCount: card.goodCount || 0, badCount: card.badCount || 0 };

    await db.runTransaction(async tx => {
      const cardRef = collectionForGroup(deckId, group, subsectionId).doc(card.id);
      const snap = await tx.get(cardRef);

      if(!snap.exists){
        result.moved = true;
        return;
      }

      const data = snap.data() || {};
      let goodCount = data.goodCount || 0;
      let badCount = data.badCount || 0;

      if(outcome === 'good'){
        goodCount += 1;
      }else{
        badCount += 1;
      }

      result.goodCount = goodCount;
      result.badCount = badCount;

      const updatePayload = {
        goodCount,
        badCount,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      const now = firebase.firestore.FieldValue.serverTimestamp();
      if(outcome === 'bad' && badCount >= 3 && group !== 'cards_hard'){
        const targetRef = collectionForGroup(deckId, 'cards_hard', subsectionId).doc(card.id);
        tx.set(targetRef, {
          ...data,
          goodCount,
          badCount,
          updatedAt: now,
          movedAt: now,
          movedReason: 'bad'
        });
        tx.delete(cardRef);
        result.moved = 'bad';
      }else if(outcome === 'good' && goodCount >= 5 && group !== 'cards_mastered'){
        const targetRef = collectionForGroup(deckId, 'cards_mastered', subsectionId).doc(card.id);
        tx.set(targetRef, {
          ...data,
          goodCount,
          badCount,
          updatedAt: now,
          movedAt: now,
          movedReason: 'good'
        });
        tx.delete(cardRef);
        result.moved = 'good';
      }else{
        tx.update(cardRef, updatePayload);
      }
    });

    return result;
  }

  async function startLearn(){
    let orderedSnap;
    let fallbackSort = false;
    try {
      orderedSnap = await collectionForGroup(currentDeck.id, currentGroup, currentSubsection?.id)
        .orderBy('createdAt', 'asc')
        .get();
    } catch (err) {
      console.warn('Konnte Karten nicht sortiert laden, verwende Fallback', err);
      orderedSnap = await collectionForGroup(currentDeck.id, currentGroup, currentSubsection?.id).get();
      fallbackSort = true;
    }

    const docs = orderedSnap.docs.map(d => {
      const data = d.data() || {};
      const createdAt = data.createdAt && typeof data.createdAt.toDate === 'function'
        ? data.createdAt.toDate().getTime()
        : (d.createTime ? d.createTime.toMillis() : 0);
      return {
        id: d.id,
        ...data,
        goodCount: data.goodCount || 0,
        badCount: data.badCount || 0,
        _createdAt: createdAt
      };
    });

    if(fallbackSort){
      docs.sort((a, b)=>{
        if(a._createdAt === b._createdAt){
          return a.id.localeCompare(b.id);
        }
        return a._createdAt - b._createdAt;
      });
    }

    learnState.cards = docs;
    learnState.idx = 0;
    learnState.showingFront = true;
    learnState.stats = {good:0,bad:0};
    const meta = groupMeta(currentGroup);
    const parts = [];
    const course = currentDeck?.courseId ? coursesState.find(c=>c.id===currentDeck.courseId) : null;
    if(course){ parts.push(course.title || 'Kurs'); }
    parts.push(currentDeck.title || 'Deck');
    if(currentSubsection){ parts.push(currentSubsection.title || 'Abschnitt'); }
    parts.push(meta.label);
    learnDeckTitle.textContent = parts.join(' · ');
    showView(viewLearn);
    renderLearn();
  }

  function renderLearn(){
    const list = learnState.cards;
    if(!list.length){
      learnFace.innerHTML = '<div>Keine Karten vorhanden.</div>';
      learnProgress.textContent = '0/0';
      knowBtns.style.display = 'none';
      nextBtn.style.display = 'none';
      return;
    }

    if(learnState.idx < 0) learnState.idx = 0;
    if(learnState.idx >= list.length) learnState.idx = list.length - 1;

    const i = learnState.idx;
    const card = list[i];
    const face = learnState.showingFront ? card.front : card.back;
    learnFace.innerHTML = '';
    learnFace.appendChild(renderFace(face));
    learnProgress.textContent = `${i+1}/${list.length}`;
    knowBtns.style.display = learnState.showingFront ? 'none' : '';
    nextBtn.style.display   = learnState.showingFront ? 'none' : '';
  }

  function nextLearn(){
    learnState.idx++;
    if(learnState.idx >= learnState.cards.length){
      showView(viewDeck);
      return;
    }
    learnState.showingFront = true;
    renderLearn();
  }

  async function handleLearnResult(outcome){
    const list = learnState.cards;
    const card = list[learnState.idx];
    if(!currentDeck || !card || learnState.showingFront) return;

    try {
      const result = await applyLearnOutcome(currentDeck.id, card, outcome, currentGroup, currentSubsection?.id);
      if(outcome === 'good'){ learnState.stats.good++; }
      else { learnState.stats.bad++; }

      if(result.moved){
        list.splice(learnState.idx, 1);
        learnState.idx--;
      }else{
        card.goodCount = result.goodCount;
        card.badCount = result.badCount;
      }
    } catch (err) {
      console.error(err);
      await dialog.alert({
        title: 'Fehler',
        message: 'Konnte Lernergebnis nicht speichern: ' + err.message
      });
      return;
    }

    nextLearn();
  }

  window.startLearn = startLearn;
  window.renderLearn = renderLearn;
  window.nextLearn = nextLearn;
  window.handleLearnResult = handleLearnResult;
})();
