// === UI Refs ===
const viewDecks = document.getElementById('viewDecks');
const viewDeck  = document.getElementById('viewDeck');
const viewLearn = document.getElementById('viewLearn');

const newDeckBtn = document.getElementById('newDeckBtn');
const newCourseBtn = document.getElementById('newCourseBtn');
const decksWrap  = document.getElementById('decks');
const backToDecksBtn = document.getElementById('backToDecks');
const deleteDeckBtn  = document.getElementById('deleteDeckBtn');
const learnBtn       = document.getElementById('learnBtn');

const deckTitle = document.getElementById('deckTitle');
const deckCourseTag = document.getElementById('deckCourseTag');
const deckGroupTag = document.getElementById('deckGroupTag');
const deckSubsectionTag = document.getElementById('deckSubsectionTag');
const cardsListWrap = document.getElementById('cardsWrap');
const cardsWrap = document.getElementById('cards');
const toggleCardsBtn = document.getElementById('toggleCardsBtn');
const renameDeckBtn = document.getElementById('renameDeckBtn');
const changeCourseBtn = document.getElementById('changeCourseBtn');
const addSubsectionBtn = document.getElementById('addSubsectionBtn');
const selectSubsectionBtn = document.getElementById('selectSubsectionBtn');
const clearSubsectionBtn = document.getElementById('clearSubsectionBtn');

const cardForm = document.getElementById('cardForm');
const cardIdInput = document.getElementById('cardId');
const frontText = document.getElementById('frontText');
const backText  = document.getElementById('backText');
const frontImageBox = document.getElementById('frontImageBox');
const backImageBox  = document.getElementById('backImageBox');
const frontPreview  = document.getElementById('frontPreview');
const backPreview   = document.getElementById('backPreview');
const frontImageInput = document.getElementById('frontImageInput');
const backImageInput  = document.getElementById('backImageInput');
const resetFormBtn  = document.getElementById('resetForm');

const learnDeckTitle = document.getElementById('learnDeckTitle');
const learnFace = document.getElementById('learnFace');
const learnProgress = document.getElementById('learnProgress');
const backToDeckBtn = document.getElementById('backToDeck');
const flipBtn = document.getElementById('flipBtn');
const nextBtn = document.getElementById('nextBtn');
const btnGood = document.getElementById('btnGood');
const btnBad  = document.getElementById('btnBad');
const knowBtns= document.getElementById('knowBtns');

// === State ===
let currentDeck = null;
let coursesState = [];
let decksState = [];
const deckSubsectionsCache = new Map();
let unsubDecks = null;
let unsubCourses = null;
let unsubCards = null;
let frontType = 'text';
let backType  = 'text';
let frontImageFile = null;
let backImageFile  = null;
let currentGroup = 'cards';
let currentSubsection = null;
let cardsCollapsed = true;
let currentCardCount = 0;
const learnState = { cards: [], idx: 0, showingFront: true, stats: {good:0, bad:0} };

const deckGroupsMeta = {
  cards: {
    key: 'cards',
    label: 'Aktive Karten',
    description: 'Alle regulären Karten dieses Decks',
    icon: '📘'
  },
  cards_hard: {
    key: 'cards_hard',
    label: 'Schwierige Karten',
    description: 'Nach 3× Nicht gewusst landeten sie hier',
    icon: '⚠️'
  },
  cards_mastered: {
    key: 'cards_mastered',
    label: 'Gemeisterte Karten',
    description: 'Nach 5× Gewusst als gelernt markiert',
    icon: '🏆'
  }
};
const deckGroupOrder = ['cards','cards_hard','cards_mastered'];

function setCardsCollapsed(collapsed){
  cardsCollapsed = !!collapsed;
  if(cardsListWrap){
    cardsListWrap.classList.toggle('hidden', cardsCollapsed);
  }
  if(toggleCardsBtn){
    const base = toggleCardsBtn.disabled
      ? 'Keine Karten'
      : (cardsCollapsed ? 'Liste anzeigen' : 'Liste ausblenden');
    const countSuffix = toggleCardsBtn.disabled ? '' : ` (${currentCardCount})`;
    const label = `${base}${countSuffix}`;
    toggleCardsBtn.textContent = label;
  }
}

newCourseBtn.addEventListener('click', async ()=>{
  await createCourseFlow();
});

newDeckBtn.addEventListener('click', async ()=>{
  const selection = await chooseCourse(null, true);
  if(selection === undefined) return;
  await createDeckInCourse(selection);
});

toggleCardsBtn.addEventListener('click', ()=>{
  setCardsCollapsed(!cardsCollapsed);
});

setCardsCollapsed(true);

function groupMeta(group){ return deckGroupsMeta[group] || deckGroupsMeta.cards; }

// === Helpers ===
function showView(el){ [viewDecks, viewDeck, viewLearn].forEach(v => v.classList.add('hidden')); el.classList.remove('hidden'); }
function escapeHtml(str=''){ return str.replace(/[&<>"]/g, s=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[s])); }
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } }

// === Decks ===
openDecks();

function openDecks(){
  showView(viewDecks);
  deckCourseTag.textContent = '';
  deckCourseTag.classList.add('hidden');
  deckGroupTag.textContent = '';
  deckGroupTag.classList.add('hidden');
  deckSubsectionTag.textContent = '';
  deckSubsectionTag.classList.add('hidden');
  clearSubsectionBtn.classList.add('hidden');
  if(unsubDecks) unsubDecks();
  if(unsubCourses) unsubCourses();
  decksWrap.innerHTML = '';
  coursesState = [];
  decksState = [];
  deckSubsectionsCache.clear();
  currentSubsection = null;
  renderDeckOverview();

  unsubCourses = colCourses().orderBy('createdAt','desc').onSnapshot((snap)=>{
    coursesState = snap.docs.map(doc=>({ id: doc.id, ...doc.data() }));
    renderDeckOverview();
    if(currentDeck && currentDeck.courseId){
      const course = coursesState.find(c=>c.id===currentDeck.courseId);
      if(course){
        deckCourseTag.textContent = course.title || 'Kurs';
        deckCourseTag.classList.remove('hidden');
      }
    }
  });

  unsubDecks = colDecks().orderBy('createdAt','desc').onSnapshot((snap)=>{
    decksState = snap.docs.map(doc=>({ id: doc.id, ...doc.data() }));
    renderDeckOverview();
    if(currentDeck){
      const latest = decksState.find(d=>d.id === currentDeck.id);
      if(latest){
        currentDeck = { ...currentDeck, ...latest, courseId: latest.courseId || null };
        const course = currentDeck.courseId ? coursesState.find(c=>c.id===currentDeck.courseId) : null;
        deckCourseTag.textContent = course ? (course.title || 'Kurs') : 'Ohne Kurs';
        deckCourseTag.classList.remove('hidden');
      }
    }
  });
}

function openDeck(deck, group='cards', subsection=null){
  currentDeck = { ...deck, courseId: deck.courseId || null };
  currentGroup = group;
  currentSubsection = subsection ? { ...subsection } : null;
  const meta = groupMeta(group);
  deckTitle.textContent = deck.title || 'Deck';
  const course = deck.courseId ? coursesState.find(c=>c.id === deck.courseId) : null;
  if(course){
    deckCourseTag.textContent = course.title || 'Kurs';
  }else{
    deckCourseTag.textContent = 'Ohne Kurs';
  }
  deckCourseTag.classList.remove('hidden');
  deckGroupTag.textContent = meta.label;
  deckGroupTag.classList.toggle('hidden', group === 'cards');
  if(currentSubsection){
    deckSubsectionTag.textContent = `Abschnitt: ${currentSubsection.title || 'Abschnitt'}`;
    deckSubsectionTag.classList.remove('hidden');
    clearSubsectionBtn.classList.remove('hidden');
  }else{
    deckSubsectionTag.textContent = '';
    deckSubsectionTag.classList.add('hidden');
    clearSubsectionBtn.classList.add('hidden');
  }
  showView(viewDeck);
  if(unsubCards) unsubCards();

  resetForm();
  setCardsCollapsed(true);

  const query = collectionForGroup(deck.id, group, currentSubsection?.id).orderBy('createdAt','desc');
  unsubCards = query.onSnapshot((snap)=>{
    cardsWrap.innerHTML = '';
    currentCardCount = snap.size;
    snap.forEach(doc=>{
      const c = { id: doc.id, ...doc.data() };
      const el = document.createElement('div');
      el.className = 'card';
      el.innerHTML = renderCardItem(c);
      el.querySelector('[data-edit]').addEventListener('click', ()=>fillForm(c));
      el.querySelector('[data-del]').addEventListener('click', async ()=>{
        const confirmed = await dialog.confirm({
          title: 'Karte löschen',
          message: 'Möchtest du diese Karte dauerhaft entfernen?',
          confirmText: 'Löschen'
        });
        if(confirmed){
          await collectionForGroup(currentDeck.id, currentGroup, currentSubsection?.id).doc(c.id).delete();
        }
      });
      cardsWrap.appendChild(el);
    });
    if(!snap.size){
      const emptyMeta = document.createElement('div');
      emptyMeta.className = 'muted empty-hint';
      emptyMeta.textContent = 'Keine Karten in dieser Kategorie.';
      cardsWrap.appendChild(emptyMeta);
    }
    toggleCardsBtn.disabled = snap.size === 0;
    if(snap.size === 0){
      setCardsCollapsed(true);
    }else{
      setCardsCollapsed(cardsCollapsed);
    }
  });
}

backToDecksBtn.onclick = ()=>{
  if(unsubCards){ unsubCards(); unsubCards = null; }
  currentDeck = null;
  currentGroup = 'cards';
  openDecks();
};

deleteDeckBtn.onclick = async ()=>{
  if(!currentDeck) return;
  const confirmed = await dialog.confirm({
    title: 'Deck löschen',
    message: `"${currentDeck.title || 'Deck'}" inklusive aller Karten löschen?`,
    confirmText: 'Löschen'
  });
  if(!confirmed) return;
  try {
    await deleteDeckTree(currentDeck);
    currentDeck = null;
    currentGroup = 'cards';
    openDecks();
  } catch(err){
    await dialog.alert({
      title: 'Fehler',
      message: 'Konnte Deck nicht löschen: ' + err.message
    });
  }
};

renameDeckBtn.onclick = async () => {
  if (!currentDeck) return;
  const currentName = deckTitle.textContent || currentDeck.title || '';
  const newTitle = await dialog.prompt({
    title: 'Deck umbenennen',
    label: 'Neuer Deck-Name',
    value: currentName,
    confirmText: 'Speichern'
  });
  if (newTitle == null) return;                 // Abgebrochen
  const t = newTitle.trim();
  if (!t || t === currentDeck.title) return;    // Nichts geändert

  try {
    await colDecks().doc(currentDeck.id).update({
      title: t,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    // UI lokal sofort aktualisieren – Snapshot kommt gleich nach
    deckTitle.textContent = t;
    currentDeck.title = t;
  } catch (e) {
    await dialog.alert({
      title: 'Fehler',
      message: 'Konnte Deck nicht umbenennen: ' + e.message
    });
  }
};

changeCourseBtn.onclick = async () => {
  if(!currentDeck) return;
  const previous = currentDeck.courseId || null;
  const selection = await chooseCourse(previous, true);
  if(selection === undefined) return;
  try {
    await colDecks().doc(currentDeck.id).update({
      courseId: selection || null,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    currentDeck.courseId = selection || null;
    const course = selection ? coursesState.find(c=>c.id === selection) : null;
    deckCourseTag.textContent = course ? (course.title || 'Kurs') : 'Ohne Kurs';
    deckCourseTag.classList.remove('hidden');
    if(selection){
      await colCourses().doc(selection).update({
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
  } catch(err){
    await dialog.alert({
      title: 'Fehler',
      message: 'Konnte Kurs nicht ändern: ' + err.message
    });
  }
};

// === Karten ===
function normalizeFace(face){
  if(!face) return null;
  const text = typeof face.text === 'string' ? face.text : '';
  const url = face.url || face.imageUrl || null;
  const type = face.type || (text && url ? 'mixed' : (url ? 'image' : 'text'));
  return { text, url, type };
}
function renderFaceMini(face){
  const normalized = normalizeFace(face);
  if(!normalized){
    return '<div class="muted">Leer</div>';
  }
  const parts = [];
  if(normalized.text){
    parts.push(`<div>${escapeHtml(normalized.text)}</div>`);
  }
  if(normalized.url){
    parts.push(`<img src="${normalized.url}" alt="Bild" style="max-width:100%; border-radius:10px">`);
  }
  if(!parts.length){
    parts.push('<div class="muted">Leer</div>');
  }
  return parts.join('');
}
function getInitialSideMode(face){
  const normalized = normalizeFace(face);
  if(normalized?.url && !normalized.text){
    return 'image';
  }
  return 'text';
}

function renderCardItem(c){
  const frontFace = normalizeFace(c.front);
  const backFace  = normalizeFace(c.back);
  const frontBadge = frontFace?.url ? '[Bild]' : '';
  const backBadge  = backFace?.url ? '[Bild]' : '';
  return `
    <div class="row" style="justify-content:space-between; gap:8px">
      <div style="flex:1; display:grid; gap:6px">
        <div><strong>Vorderseite</strong> <span class="muted">${frontBadge}</span>${renderFaceMini(frontFace)}</div>
        <div><strong>Rückseite</strong>  <span class="muted">${backBadge}</span>${renderFaceMini(backFace)}</div>
      </div>
      <div class="row" style="align-items:flex-start">
        <button class="btn" data-edit>✏️</button>
        <button class="btn danger" data-del>🗑️</button>
      </div>
    </div>`;
}

function revokePreviewUrl(previewEl){
  if(previewEl?.dataset?.objectUrl){
    URL.revokeObjectURL(previewEl.dataset.objectUrl);
    delete previewEl.dataset.objectUrl;
  }
}

function setImageFromFile(side, file){
  if(!file) return;
  const preview = side === 'front' ? frontPreview : backPreview;
  revokePreviewUrl(preview);
  const url = URL.createObjectURL(file);
  preview.innerHTML = `<img src="${url}" alt="Preview">`;
  preview.dataset.objectUrl = url;
  if(side === 'front'){
    frontImageFile = file;
    frontType = 'image';
    setSide('front','image');
    frontImageInput.value = '';
  }else{
    backImageFile = file;
    backType = 'image';
    setSide('back','image');
    backImageInput.value = '';
  }
}

function fillForm(c){
  cardIdInput.value = c.id;

  const frontFace = normalizeFace(c.front);
  const backFace  = normalizeFace(c.back);

  setSide('front', getInitialSideMode(frontFace));
  frontText.value = frontFace?.text || '';
  revokePreviewUrl(frontPreview);
  if(frontFace?.url){
    frontPreview.innerHTML = `<img src="${frontFace.url}" alt="Preview">`;
  }else{
    frontPreview.innerHTML = '';
  }
  frontImageFile = null;
  frontImageInput.value = '';

  setSide('back', getInitialSideMode(backFace));
  backText.value = backFace?.text || '';
  revokePreviewUrl(backPreview);
  if(backFace?.url){
    backPreview.innerHTML = `<img src="${backFace.url}" alt="Preview">`;
  }else{
    backPreview.innerHTML = '';
  }
  backImageFile = null;
  backImageInput.value = '';
}

function resetForm(){
  cardIdInput.value = '';
  setSide('front','text'); setSide('back','text');
  frontText.value=''; backText.value='';
  revokePreviewUrl(frontPreview); frontPreview.innerHTML='';
  revokePreviewUrl(backPreview); backPreview.innerHTML='';
  frontImageFile = null; backImageFile = null;
  frontImageInput.value = '';
  backImageInput.value = '';
}
resetFormBtn.onclick = resetForm;

cardForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  if(!currentDeck) return;

  const id = cardIdInput.value || null;
  const front = await buildFace('front');
  const back  = await buildFace('back');

  const payload = {
    front,
    back,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  if(id){
    await collectionForGroup(currentDeck.id, currentGroup, currentSubsection?.id).doc(id).set(payload, { merge:true });
  }else{
    payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    payload.goodCount = 0;
    payload.badCount = 0;
    await collectionForGroup(currentDeck.id, currentGroup, currentSubsection?.id).add(payload);
  }
  resetForm();
});

async function buildFace(side){
  const textValue = (side==='front' ? frontText : backText).value.trim();
  const preview = side==='front' ? frontPreview : backPreview;
  const file = side==='front' ? frontImageFile : backImageFile;

  let imageUrl = null;
  const prevImg = preview.querySelector('img');
  if(file){
    const cardId = cardIdInput.value || ('tmp_'+Date.now());
    const basePath = currentSubsection
      ? `public/decks/${currentDeck.id}/subsections/${currentSubsection.id}`
      : `public/decks/${currentDeck.id}`;
    const path = `${basePath}/${currentGroup}/${cardId}/${side}_${Date.now()}_${file.name || 'clip.png'}`;
    const ref = storage.ref().child(path);
    await ref.put(file, { contentType: file.type || 'image/png' });
    imageUrl = await ref.getDownloadURL();
    preview.innerHTML = `<img src="${imageUrl}" alt="Preview">`;
    delete preview.dataset.objectUrl;
    if(side==='front'){
      frontImageFile = null;
      frontImageInput.value = '';
    }else{
      backImageFile = null;
      backImageInput.value = '';
    }
  }else if(prevImg){
    imageUrl = prevImg.src;
  }

  const hasText = textValue.length > 0;
  const hasImage = !!imageUrl;
  if(!hasText && !hasImage) return null;

  const result = {
    type: hasText && hasImage ? 'mixed' : (hasImage ? 'image' : 'text')
  };
  if(hasText) result.text = textValue;
  if(hasImage) result.url = imageUrl;
  return result;
}

// === Paste & Toggles ===
function attachSideToggles(){
  document.querySelectorAll('.side-toggle').forEach(group=>{
    const side = group.dataset.side;
    group.querySelectorAll('.seg').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        group.querySelectorAll('.seg').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        setSide(side, btn.dataset.type);
      });
    });
  });

  [frontImageBox, backImageBox].forEach(box=>{
    box.addEventListener('focus', ()=>box.classList.add('focus'));
    box.addEventListener('blur', ()=>box.classList.remove('focus'));
  });

  [
    ['front', frontImageBox, frontImageInput],
    ['back', backImageBox, backImageInput]
  ].forEach(([side, box, input])=>{
    if(!box || !input) return;
    const openPicker = ()=> input.click();
    box.addEventListener('click', openPicker);
    box.addEventListener('keydown', (e)=>{
      if(e.key === 'Enter' || e.key === ' '){
        e.preventDefault();
        openPicker();
      }
    });
    input.addEventListener('change', ()=>{
      const file = input.files && input.files[0];
      if(file){
        setImageFromFile(side, file);
      }
      input.value = '';
    });
  });

  updateSideToggle('front', frontType);
  updateSideToggle('back', backType);

  document.addEventListener('paste', (e)=>{
    const ae = document.activeElement;
    if(ae === frontImageBox || ae === frontText){ return handlePaste(e, 'front'); }
    if(ae === backImageBox  || ae === backText) { return handlePaste(e, 'back'); }
  });

  frontImageBox.addEventListener('paste', (e)=>handlePaste(e,'front'));
  backImageBox.addEventListener('paste', (e)=>handlePaste(e,'back'));
}
attachSideToggles();

function setSide(side, type){
  if(side==='front'){ frontType = type; } else { backType = type; }
  const ta  = side==='front' ? frontText : backText;
  const box = side==='front' ? frontImageBox : backImageBox;
  if(type==='text'){
    ta.style.display='';
    box.style.display='none';
  }else{
    ta.style.display='none';
    box.style.display='';
    box.focus();
  }
  updateSideToggle(side, type);
}

function updateSideToggle(side, type){
  const group = document.querySelector(`.side-toggle[data-side="${side}"]`);
  if(!group) return;
  group.querySelectorAll('.seg').forEach(btn=>{
    btn.classList.toggle('active', btn.dataset.type === type);
  });
}

function handlePaste(e, side){
  if(!(e.clipboardData && e.clipboardData.items)) return;
  const item = Array.from(e.clipboardData.items).find(i => i.type && i.type.startsWith('image/'));
  if(!item) return; // normaler Text-Paste
  e.preventDefault();
  const file = item.getAsFile(); if(!file) return;
  setImageFromFile(side, file);
}

// === Learn ===
learnBtn.onclick = startLearn;
backToDeckBtn.onclick = ()=>showView(viewDeck);
flipBtn.onclick = ()=>{ learnState.showingFront = !learnState.showingFront; renderLearn(); };
nextBtn.onclick = nextLearn;
btnGood.onclick = ()=>handleLearnResult('good');
btnBad.onclick  = ()=>handleLearnResult('bad');
addSubsectionBtn.onclick = async ()=>{
  if(!currentDeck) return;
  const created = await createDeckSubsection(currentDeck);
  if(created){
    renderDeckOverview();
    openDeck({ ...currentDeck }, currentGroup, created);
  }
};
selectSubsectionBtn.onclick = async ()=>{
  if(!currentDeck) return;
  const subsections = await ensureDeckSubsections(currentDeck.id, true);
  if(!subsections.length){
    await dialog.alert({ title: 'Keine Abschnitte', message: 'Dieses Deck hat noch keine Abschnitte.' });
    return;
  }
  const options = [
    {
      label: 'Gesamtes Deck',
      value: '__base',
      description: 'Alle Karten ohne Abschnitt',
      active: !currentSubsection
    },
    ...subsections.map(sub => ({
      label: sub.title || 'Abschnitt',
      value: sub.id,
      description: 'Abschnitt dieses Decks',
      active: currentSubsection?.id === sub.id
    }))
  ];
  const choice = await dialog.select({
    title: 'Abschnitt wählen',
    message: 'Wähle den Abschnitt, den du anzeigen möchtest.',
    options,
    cancelText: 'Abbrechen',
    allowNone: true
  });
  if(choice === undefined) return;
  if(choice === '__base'){
    openDeck({ ...currentDeck }, currentGroup, null);
    return;
  }
  const subsection = subsections.find(s => s.id === choice);
  if(subsection){
    openDeck({ ...currentDeck }, currentGroup, subsection);
  }
};
clearSubsectionBtn.onclick = ()=>{
  if(!currentDeck || !currentSubsection) return;
  openDeck({ ...currentDeck }, currentGroup, null);
};

function renderDeckListItem(deck){
  const wrap = document.createElement('div');
  wrap.className = 'deck-list-item card';

  const subId = `deck-sub-${deck.id}`;
  const hasCourse = Boolean(deck.courseId);
  const courseLabel = hasCourse ? 'Kurs wechseln' : 'Kurs wählen';

  wrap.innerHTML = `
    <div class="deck-item-header">
      <div class="deck-item-info">
        <div class="deck-card-title">${escapeHtml(deck.title || 'Unbenannt')}</div>
        <div class="muted">${escapeHtml(deck.description || '')}</div>
      </div>
      <div class="deck-item-actions">
        <button class="btn primary" data-open="cards">Öffnen</button>
        <button class="btn" data-change-course>${courseLabel}</button>
        <button class="btn danger" data-delete-deck title="Deck löschen">🗑️</button>
        <button class="deck-item-toggle" aria-expanded="false" aria-controls="${subId}">
          <span>Unterdecks</span>
          <span class="chevron"></span>
        </button>
      </div>
    </div>
    <div class="deck-sublist hidden" id="${subId}"></div>
  `;

  wrap.querySelector('[data-open]').addEventListener('click', ()=>openDeck(deck, 'cards'));

  const changeBtn = wrap.querySelector('[data-change-course]');
  changeBtn.addEventListener('click', async ()=>{
    const prevCourse = deck.courseId || null;
    const selection = await chooseCourse(prevCourse, true);
    if(selection === undefined) return;
    try {
      await colDecks().doc(deck.id).update({
        courseId: selection || null,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      if(selection){
        await colCourses().doc(selection).update({
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
      deck.courseId = selection || null;
      changeBtn.textContent = selection ? 'Kurs wechseln' : 'Kurs wählen';
    } catch (err) {
      await dialog.alert({
        title: 'Fehler',
        message: 'Konnte Kurs nicht zuweisen: ' + err.message
      });
    }
  });

  const toggleBtn = wrap.querySelector('.deck-item-toggle');
  const subList = wrap.querySelector('.deck-sublist');

  toggleBtn.addEventListener('click', ()=>{
    const expanded = toggleBtn.getAttribute('aria-expanded') === 'true';
    toggleBtn.setAttribute('aria-expanded', String(!expanded));
    subList.classList.toggle('hidden', expanded);
    toggleBtn.classList.toggle('expanded', !expanded);
    if(!expanded){
      if(!subList.dataset.initialized){
        buildSubdeckList(subList, deck);
        subList.dataset.initialized = '1';
      }else{
        fetchDeckCounts(deck, subList);
      }
    }
  });

  wrap.querySelector('[data-delete-deck]').addEventListener('click', async ()=>{
    const label = deck.title || 'Deck';
    const confirmed = await dialog.confirm({
      title: 'Deck löschen',
      message: `"${label}" inklusive aller Karten löschen?`,
      confirmText: 'Löschen'
    });
    if(!confirmed) return;
    try {
      await deleteDeckTree({ id: deck.id, courseId: deck.courseId || null });
    } catch(err){
      await dialog.alert({ title: 'Fehler', message: 'Konnte Deck nicht löschen: ' + err.message });
    }
  });

  return wrap;
}

function renderCourseCard(course, decks){
  const wrap = document.createElement('div');
  wrap.className = 'course-card card';
  const count = decks.length;
  wrap.innerHTML = `
    <div class="course-card-header">
      <div class="course-card-meta">
        <h3 class="course-title">${escapeHtml(course.title || 'Unbenannter Kurs')}</h3>
        <div class="course-subtitle">${count} Unterdeck${count === 1 ? '' : 's'}</div>
      </div>
      <button class="course-delete-btn" data-delete title="Kurs löschen">🗑️</button>
      </div>
    <div class="course-card-actions">
      <button class="btn" data-add>+ Unterdeck</button>
      <button class="btn" data-rename>Umbenennen</button>
    </div>
    <div class="course-decks"></div>
  `;

  const list = wrap.querySelector('.course-decks');
  if(decks.length){
    decks.forEach(deck => list.appendChild(renderDeckListItem(deck)));
  }else{
    const empty = document.createElement('div');
    empty.className = 'muted empty-hint';
    empty.textContent = 'Noch keine Unterdecks.';
    list.appendChild(empty);
  }

  wrap.querySelector('[data-add]').addEventListener('click', async ()=>{
    await createDeckInCourse(course.id);
  });

  wrap.querySelector('[data-rename]').addEventListener('click', async ()=>{
    const name = await dialog.prompt({
      title: 'Kurs umbenennen',
      label: 'Neuer Kursname',
      value: course.title || '',
      confirmText: 'Speichern'
    });
    if(name == null) return;
    const t = name.trim();
    if(!t || t === course.title) return;
    try {
      await colCourses().doc(course.id).update({
        title: t,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch(err){
      await dialog.alert({
        title: 'Fehler',
        message: 'Konnte Kurs nicht umbenennen: ' + err.message
      });
    }
  });

  wrap.querySelector('[data-delete]').addEventListener('click', async ()=>{
    const confirmed = await dialog.confirm({
      title: 'Kurs löschen',
      message: `"${course.title || 'Kurs'}" löschen? Unterdecks werden ohne Kurs weitergeführt.`,
      confirmText: 'Löschen'
    });
    if(!confirmed) return;
    try {
      const batch = db.batch();
      decksState.filter(d => d.courseId === course.id).forEach(deck => {
        batch.update(colDecks().doc(deck.id), {
          courseId: null,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      });
      batch.delete(colCourses().doc(course.id));
      await batch.commit();
    } catch(err){
      await dialog.alert({
        title: 'Fehler',
        message: 'Konnte Kurs nicht löschen: ' + err.message
      });
    }
  });

  return wrap;
}

function renderUnassignedCard(decks){
  const wrap = document.createElement('div');
  wrap.className = 'course-card card unassigned-card';
  wrap.innerHTML = `
    <div class="course-card-header">
      <div class="course-card-meta">
        <h3 class="course-title">Ohne Kurs</h3>
        <div class="course-subtitle">${decks.length} Unterdeck${decks.length === 1 ? '' : 's'} · Kurse zuweisen, um Ordnung zu schaffen.</div>
      </div>
    </div>
    <div class="course-card-actions">
      <button class="btn" data-add>+ Unterdeck</button>
    </div>
    <div class="course-decks"></div>
  `;

  const list = wrap.querySelector('.course-decks');
  decks.forEach(deck => list.appendChild(renderDeckListItem(deck)));

  wrap.querySelector('[data-add]').addEventListener('click', async ()=>{
    await createDeckInCourse(null);
  });

  return wrap;
}

function renderDeckOverview(){
  decksWrap.innerHTML = '';

  if(!coursesState.length && !decksState.length){
    const empty = document.createElement('div');
    empty.className = 'card empty-hint';
    empty.textContent = 'Noch keine Kurse oder Unterdecks angelegt.';
    decksWrap.appendChild(empty);
    return;
  }

  const knownCourseIds = new Set(coursesState.map(c=>c.id));
  const grouped = decksState.reduce((acc, deck)=>{
    let key = deck.courseId || null;
    if(deck.courseId && !knownCourseIds.has(deck.courseId)){
      key = '__orphans';
    }
    if(!acc[key]) acc[key] = [];
    acc[key].push(deck);
    return acc;
  }, {});

  coursesState.forEach(course => {
    const decks = grouped[course.id] || [];
    decksWrap.appendChild(renderCourseCard(course, decks));
  });

  if(grouped.null && grouped.null.length){
    decksWrap.appendChild(renderUnassignedCard(grouped.null));
  }

  if(grouped.__orphans && grouped.__orphans.length){
    const orphanCard = renderUnassignedCard(grouped.__orphans);
    const countText = `${grouped.__orphans.length} Unterdeck${grouped.__orphans.length === 1 ? '' : 's'} · Zugehöriger Kurs wurde entfernt.`;
    orphanCard.querySelector('.course-title').textContent = 'Ohne Kursreferenz';
    orphanCard.querySelector('.course-subtitle').textContent = countText;
    decksWrap.appendChild(orphanCard);
  }
}

async function chooseCourse(currentId = null, allowNone = true){
  if(!coursesState.length){
    const create = await dialog.confirm({
      title: 'Kein Kurs vorhanden',
      message: 'Es existiert noch kein Kurs. Möchtest du jetzt einen Kurs erstellen?',
      confirmText: 'Kurs erstellen',
      cancelText: allowNone ? 'Ohne Kurs' : 'Abbrechen'
    });
    if(!create){
      return allowNone ? null : undefined;
    }
    const created = await createCourseFlow();
    return created || (allowNone ? null : undefined);
  }

  const optionList = coursesState.map(course => ({
    label: course.title || 'Unbenannt',
    value: course.id,
    description: course.id === currentId ? 'Aktuell ausgewählt' : '',
    active: course.id === currentId
  }));

  if(allowNone){
    optionList.push({
      label: 'Ohne Kurs',
      value: null,
      description: 'Unterdeck ohne Kurs verwalten',
      active: currentId == null
    });
  }

  const selection = await dialog.select({
    title: 'Kurs wählen',
    message: 'Wähle den Kurs aus, dem dieses Unterdeck zugeordnet werden soll.',
    options: optionList,
    cancelText: 'Abbrechen',
    allowNone: true
  });
  return selection;
}

async function createCourseFlow(){
  const name = await dialog.prompt({
    title: 'Neuer Kurs',
    label: 'Kurstitel',
    placeholder: 'z. B. Mathe 1',
    confirmText: 'Erstellen'
  });
  if(name == null) return null;
  const t = name.trim();
  if(!t) return null;
  try {
    const ref = await colCourses().add({
      title: t,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return ref.id;
  } catch(err){
    await dialog.alert({
      title: 'Fehler',
      message: 'Konnte Kurs nicht erstellen: ' + err.message
    });
    return null;
  }
}

async function createDeckInCourse(courseId){
  const title = await dialog.prompt({
    title: 'Neues Unterdeck',
    label: 'Unterdeck-Titel',
    placeholder: 'z. B. Wiederholung Kapitel 1',
    confirmText: 'Erstellen'
  });
  if(title == null) return;
  const t = title.trim();
  if(!t) return;
  try {
    await colDecks().add({
      title: t,
      description: '',
      courseId: courseId || null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    if(courseId){
      await colCourses().doc(courseId).update({
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
  } catch(err){
    await dialog.alert({
      title: 'Fehler',
      message: 'Konnte Unterdeck nicht erstellen: ' + err.message
    });
  }
}

function buildSubdeckList(container, deck){
  container.innerHTML = '';

  const groupList = document.createElement('div');
  groupList.className = 'deck-group-list';

  deckGroupOrder.forEach(groupKey => {
    const meta = groupMeta(groupKey);
    const item = document.createElement('button');
    item.className = 'deck-subitem';
    item.dataset.group = groupKey;
    item.innerHTML = `
      <div class="deck-subitem-main">
        <span class="deck-subitem-icon">${meta.icon}</span>
        <div class="deck-subitem-copy">
          <span class="deck-subitem-title">${meta.label}</span>
          <span class="deck-subitem-desc">${meta.description}</span>
        </div>
      </div>
      <span class="deck-subitem-count" data-count>${'…'}</span>
    `;
    item.addEventListener('click', ()=>openDeck(deck, groupKey));
    groupList.appendChild(item);
  });

  container.appendChild(groupList);
  fetchGroupCounts(deck.id, groupList, null);
  renderDeckSubsections(container, deck).catch(err => {
    console.error('Konnte Abschnitte rendern', err);
  });
}

async function fetchGroupCounts(deckId, container, subsectionId=null){
  try {
    const [activeSnap, hardSnap, masteredSnap] = await Promise.all([
      collectionForGroup(deckId,'cards', subsectionId).get(),
      collectionForGroup(deckId,'cards_hard', subsectionId).get(),
      collectionForGroup(deckId,'cards_mastered', subsectionId).get()
    ]);
    const counts = {
      cards: activeSnap.size,
      cards_hard: hardSnap.size,
      cards_mastered: masteredSnap.size
    };
    container.querySelectorAll('.deck-subitem').forEach(btn => {
      const groupKey = btn.dataset.group;
      const countEl = btn.querySelector('[data-count]');
      if(countEl){ countEl.textContent = counts[groupKey] ?? 0; }
    });
  } catch (err) {
    console.error('Konnte Deck-Statistiken nicht laden', err);
    container.querySelectorAll('[data-count]').forEach(el => el.textContent = '?');
  }
}

async function renderDeckSubsections(container, deck){
  const block = document.createElement('div');
  block.className = 'deck-subsections-block card-lite';
  block.innerHTML = `
    <div class="deck-subsections-header">
      <div class="deck-subsections-title">Abschnitte</div>
      <button class="btn" data-add-sub>+ Abschnitt</button>
    </div>
    <div class="deck-subsections-list"></div>
  `;
  container.appendChild(block);

  const listEl = block.querySelector('.deck-subsections-list');

  const refresh = async (force=false)=>{
    const subsections = await ensureDeckSubsections(deck.id, force);
    listEl.innerHTML = '';
    if(!subsections.length){
      const empty = document.createElement('div');
      empty.className = 'muted empty-hint';
      empty.textContent = 'Noch keine Abschnitte.';
      listEl.appendChild(empty);
      return;
    }
    subsections.forEach(subsection => {
      const row = renderDeckSubsectionCard(deck, subsection, refresh);
      listEl.appendChild(row);
      const groupsContainer = row.querySelector('.deck-subsection-groups');
      fetchGroupCounts(deck.id, groupsContainer, subsection.id);
    });
  };

  block.querySelector('[data-add-sub]').addEventListener('click', async ()=>{
    const created = await createDeckSubsection(deck);
    if(created){
      await refresh(true);
      renderDeckOverview();
      if(currentDeck && currentDeck.id === deck.id){
        openDeck({ ...currentDeck }, currentGroup, created);
      }
    }
  });

  await refresh(true);
}

function renderDeckSubsectionCard(deck, subsection, refreshFn){
  const wrapper = document.createElement('div');
  wrapper.className = 'deck-subsection-card';
  wrapper.innerHTML = `
    <div class="deck-subsection-header">
      <div class="deck-subsection-title">${escapeHtml(subsection.title || 'Abschnitt')}</div>
      <div class="deck-subsection-actions">
        <button class="btn" data-rename>Umbenennen</button>
        <button class="btn danger" data-delete>🗑️</button>
      </div>
    </div>
    <div class="deck-subsection-groups deck-group-list"></div>
  `;

  const groupsContainer = wrapper.querySelector('.deck-subsection-groups');
  deckGroupOrder.forEach(groupKey => {
    const meta = groupMeta(groupKey);
    const item = document.createElement('button');
    item.className = 'deck-subitem deck-subitem-compact';
    item.dataset.group = groupKey;
    item.innerHTML = `
      <div class="deck-subitem-main">
        <span class="deck-subitem-icon">${meta.icon}</span>
        <div class="deck-subitem-copy">
          <span class="deck-subitem-title">${meta.label}</span>
        </div>
      </div>
      <span class="deck-subitem-count" data-count>${'…'}</span>
    `;
    item.addEventListener('click', ()=>openDeck(deck, groupKey, subsection));
    groupsContainer.appendChild(item);
  });

  wrapper.querySelector('[data-rename]').addEventListener('click', async ()=>{
    const updated = await renameDeckSubsection(deck, subsection);
    if(updated){
      await refreshFn(true);
      renderDeckOverview();
      if(currentSubsection && currentDeck && currentDeck.id === deck.id && currentSubsection.id === subsection.id){
        currentSubsection = { ...updated };
        deckSubsectionTag.textContent = currentSubsection.title || 'Abschnitt';
      }
    }
  });

  wrapper.querySelector('[data-delete]').addEventListener('click', async ()=>{
    const removed = await deleteDeckSubsection(deck, subsection);
    if(removed){
      await refreshFn(true);
      renderDeckOverview();
      if(currentSubsection && currentDeck && currentDeck.id === deck.id && currentSubsection.id === subsection.id){
        openDeck({ ...currentDeck }, currentGroup, null);
      }
    }
  });

  return wrapper;
}

async function ensureDeckSubsections(deckId, force=false){
  if(!force && deckSubsectionsCache.has(deckId)){
    return deckSubsectionsCache.get(deckId);
  }
  const snap = await colSubsections(deckId).orderBy('createdAt','asc').get();
  const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  deckSubsectionsCache.set(deckId, list);
  return list;
}

async function createDeckSubsection(deck){
  if(!deck?.id) return null;
  const name = await dialog.prompt({
    title: 'Neuer Abschnitt',
    label: 'Abschnittstitel',
    placeholder: 'z. B. Kapitel 1',
    confirmText: 'Erstellen'
  });
  if(name == null) return null;
  const t = name.trim();
  if(!t) return null;
  try {
    const ref = await colSubsections(deck.id).add({
      title: t,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    const newSubsection = { id: ref.id, title: t };
    const list = deckSubsectionsCache.get(deck.id) || [];
    deckSubsectionsCache.set(deck.id, [...list, newSubsection]);
    return newSubsection;
  } catch(err){
    await dialog.alert({
      title: 'Fehler',
      message: 'Konnte Abschnitt nicht erstellen: ' + err.message
    });
    return null;
  }
}

async function renameDeckSubsection(deck, subsection){
  const name = await dialog.prompt({
    title: 'Abschnitt umbenennen',
    label: 'Neuer Abschnittstitel',
    value: subsection.title || '',
    confirmText: 'Speichern'
  });
  if(name == null) return null;
  const t = name.trim();
  if(!t || t === subsection.title) return null;
  try {
    await colSubsections(deck.id).doc(subsection.id).update({
      title: t,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    const list = deckSubsectionsCache.get(deck.id) || [];
    const idx = list.findIndex(s => s.id === subsection.id);
    if(idx >= 0){
      list[idx] = { ...list[idx], title: t };
      deckSubsectionsCache.set(deck.id, [...list]);
    }
    return { id: subsection.id, title: t };
  } catch(err){
    await dialog.alert({
      title: 'Fehler',
      message: 'Konnte Abschnitt nicht umbenennen: ' + err.message
    });
    return null;
  }
}

async function deleteDeckSubsection(deck, subsection){
  const confirmed = await dialog.confirm({
    title: 'Abschnitt löschen',
    message: `"${subsection.title || 'Abschnitt'}" inklusive Karten löschen?`,
    confirmText: 'Löschen'
  });
  if(!confirmed) return false;
  try {
    await deleteSubsectionTree(deck.id, subsection);
    return true;
  } catch(err){
    await dialog.alert({
      title: 'Fehler',
      message: 'Konnte Abschnitt nicht löschen: ' + err.message
    });
    return false;
  }
}
async function deleteDeckTree(deck){
  if(!deck?.id) return;
  const deckId = deck.id;
  const courseId = deck.courseId || null;

  const subsectionsSnap = await colSubsections(deckId).get();
  for(const doc of subsectionsSnap.docs){
    await deleteSubsectionTree(deckId, { id: doc.id });
  }

  const batch = db.batch();
  const deckRef = colDecks().doc(deckId);
  const [activeSnap, hardSnap, masteredSnap] = await Promise.all([
    collectionForGroup(deckId, 'cards').get(),
    collectionForGroup(deckId, 'cards_hard').get(),
    collectionForGroup(deckId, 'cards_mastered').get()
  ]);
  activeSnap.forEach(doc=> batch.delete(doc.ref));
  hardSnap.forEach(doc=> batch.delete(doc.ref));
  masteredSnap.forEach(doc=> batch.delete(doc.ref));
  batch.delete(deckRef);
  await batch.commit();
  deckSubsectionsCache.delete(deckId);
  if(courseId){
    try {
      await colCourses().doc(courseId).update({
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch(err){
      console.error('Konnte Kurs-Zeitstempel nicht aktualisieren', err);
    }
  }
}

async function deleteSubsectionTree(deckId, subsection){
  const subsectionId = typeof subsection === 'string' ? subsection : subsection?.id;
  if(!deckId || !subsectionId) return;
  const batch = db.batch();
  const subsectionRef = colSubsections(deckId).doc(subsectionId);
  const [cardsSnap, hardSnap, masteredSnap] = await Promise.all([
    collectionForGroup(deckId, 'cards', subsectionId).get(),
    collectionForGroup(deckId, 'cards_hard', subsectionId).get(),
    collectionForGroup(deckId, 'cards_mastered', subsectionId).get()
  ]);
  cardsSnap.forEach(doc => batch.delete(doc.ref));
  hardSnap.forEach(doc => batch.delete(doc.ref));
  masteredSnap.forEach(doc => batch.delete(doc.ref));
  batch.delete(subsectionRef);
  await batch.commit();
  const cache = deckSubsectionsCache.get(deckId);
  if(cache){
    deckSubsectionsCache.set(deckId, cache.filter(s => s.id !== subsectionId));
  }
}
