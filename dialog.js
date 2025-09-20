(function(){
  const dialogOverlay = document.getElementById('appDialog');
  const dialogTitleEl = document.getElementById('dialogTitle');
  const dialogMessageEl = document.getElementById('dialogMessage');
  const dialogInputWrap = document.getElementById('dialogInputWrap');
  const dialogInputLabel = document.getElementById('dialogInputLabel');
  const dialogInputEl = document.getElementById('dialogInput');
  const dialogCustom = document.getElementById('dialogCustom');
  const dialogActionsEl = document.getElementById('dialogActions');
  const dialogConfirmBtn = document.getElementById('dialogConfirm');
  const dialogCancelBtn = document.getElementById('dialogCancel');
  const dialogCloseBtn = document.getElementById('dialogClose');

  function createDialog(){
    let resolver = null;
    let currentOptions = null;
    let previousActive = null;

    const validateInput = ()=>{
      if(currentOptions?.mode === 'prompt'){
        dialogInputEl.classList.remove('is-invalid');
        if(currentOptions.required){
          const value = currentOptions.trim === false ? dialogInputEl.value : dialogInputEl.value.trim();
          dialogConfirmBtn.disabled = !value;
        }
      }
    };

    dialogInputEl.addEventListener('input', validateInput);

    const handleConfirm = ()=>{
      if(!currentOptions) return;
      if(currentOptions.mode === 'prompt'){
        let value = dialogInputEl.value;
        if(currentOptions.trim !== false){
          value = value.trim();
        }
        if(currentOptions.required && !value){
          dialogInputEl.classList.add('is-invalid');
          dialogInputEl.focus();
          return;
        }
        close(value);
      }else{
        close(true);
      }
    };

    const handleCancel = ()=>{
      if(!currentOptions) return;
      close(currentOptions.cancelResult);
    };

    const handleKeydown = (e)=>{
      if(!currentOptions) return;
      if(e.key === 'Escape' && currentOptions.dismissible !== false){
        e.preventDefault();
        handleCancel();
      }
      if(e.key === 'Enter' && currentOptions.mode === 'prompt' && document.activeElement === dialogInputEl){
        e.preventDefault();
        handleConfirm();
      }
    };

    dialogConfirmBtn.addEventListener('click', handleConfirm);
    dialogCancelBtn.addEventListener('click', handleCancel);
    dialogCloseBtn.addEventListener('click', handleCancel);
    dialogOverlay.addEventListener('click', (e)=>{
      if(e.target === dialogOverlay && currentOptions?.dismissible !== false){
        handleCancel();
      }
    });

    function reset(){
      dialogMessageEl.textContent = '';
      dialogMessageEl.classList.remove('hidden');
      dialogCustom.innerHTML = '';
      dialogInputWrap.classList.add('hidden');
      dialogInputLabel.classList.remove('hidden');
      dialogInputEl.value = '';
      dialogInputEl.placeholder = '';
      dialogInputEl.classList.remove('is-invalid');
      dialogConfirmBtn.disabled = false;
    }

    function setActionsVisibility(showConfirm, showCancel){
      dialogConfirmBtn.classList.toggle('hidden', !showConfirm);
      dialogCancelBtn.classList.toggle('hidden', !showCancel);
      dialogActionsEl.classList.toggle('hidden', !showConfirm && !showCancel);
    }

    function open(options){
      if(resolver){
        close(currentOptions?.cancelResult);
      }

      currentOptions = {
        mode: options.mode || 'confirm',
        dismissible: options.dismissible !== false,
        cancelResult: options.cancelResult !== undefined
          ? options.cancelResult
          : options.mode === 'prompt' ? null
          : options.mode === 'select' ? undefined
          : false,
        required: options.required !== undefined ? options.required : true,
        trim: options.trim !== undefined ? options.trim : true
      };

      reset();

      dialogTitleEl.textContent = options.title || '';
      dialogTitleEl.classList.toggle('hidden', !options.title);

      if(options.message){
        dialogMessageEl.textContent = options.message;
        dialogMessageEl.classList.remove('hidden');
      }else{
        dialogMessageEl.classList.add('hidden');
      }

      previousActive = document.activeElement instanceof HTMLElement ? document.activeElement : null;

      const showCancel = options.showCancel !== false;
      const showConfirmDefault = options.showConfirm !== false && currentOptions.mode !== 'select';
      dialogConfirmBtn.textContent = options.confirmText || 'Okay';
      dialogCancelBtn.textContent = options.cancelText || 'Abbrechen';
      setActionsVisibility(showConfirmDefault, showCancel);

      if(currentOptions.mode === 'prompt'){
        dialogInputWrap.classList.remove('hidden');
        if(options.label){
          dialogInputLabel.textContent = options.label;
          dialogInputLabel.classList.remove('hidden');
        }else{
          dialogInputLabel.classList.add('hidden');
        }
        dialogInputEl.placeholder = options.placeholder || '';
        dialogInputEl.value = options.value ?? '';
        dialogConfirmBtn.disabled = currentOptions.required && !(currentOptions.trim === false ? dialogInputEl.value : dialogInputEl.value.trim());
        validateInput();
        requestAnimationFrame(()=>{
          dialogInputEl.focus();
          dialogInputEl.select();
        });
      }

      if(currentOptions.mode === 'select'){
        const list = document.createElement('div');
        list.className = 'dialog-option-list';
        (options.options || []).forEach(opt => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'dialog-option';
          if(opt.active) btn.classList.add('is-active');

          const textWrap = document.createElement('div');
          textWrap.className = 'dialog-option-text';
          const title = document.createElement('span');
          title.className = 'dialog-option-title';
          title.textContent = opt.label;
          textWrap.appendChild(title);
          if(opt.description){
            const desc = document.createElement('span');
            desc.className = 'dialog-option-desc';
            desc.textContent = opt.description;
            textWrap.appendChild(desc);
          }
          btn.appendChild(textWrap);
          btn.addEventListener('click', ()=> close(opt.value));
          list.appendChild(btn);
        });
        dialogCustom.appendChild(list);
        setActionsVisibility(false, showCancel);
      }

      if(options.customRender){
        options.customRender(dialogCustom, close);
      }

      dialogOverlay.classList.remove('hidden');
      dialogOverlay.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleKeydown);

      if(currentOptions.mode !== 'prompt'){
        requestAnimationFrame(()=>{
          if(showConfirmDefault){
            dialogConfirmBtn.focus();
          }else if(showCancel){
            dialogCancelBtn.focus();
          }else{
            dialogCloseBtn.focus();
          }
        });
      }

      return new Promise(resolve => {
        resolver = resolve;
      });
    }

    function close(result){
      if(!resolver) return;
      document.removeEventListener('keydown', handleKeydown);
      dialogOverlay.classList.add('hidden');
      dialogOverlay.setAttribute('aria-hidden', 'true');
      document.body.style.removeProperty('overflow');
      reset();
      const resolveFn = resolver;
      const opts = currentOptions;
      resolver = null;
      currentOptions = null;
      if(previousActive && typeof previousActive.focus === 'function'){
        previousActive.focus({ preventScroll: true });
      }
      previousActive = null;
      const value = typeof result === 'undefined' ? opts?.cancelResult : result;
      resolveFn(value);
    }

    return {
      async alert({ title = 'Hinweis', message = '', confirmText = 'Okay' } = {}){
        await open({ title, message, confirmText, showCancel: false, cancelResult: undefined, mode: 'alert' });
      },
      async confirm({ title = 'Bestätigen', message = '', confirmText = 'Okay', cancelText = 'Abbrechen' } = {}){
        const result = await open({ title, message, confirmText, cancelText, mode: 'confirm' });
        return !!result;
      },
      async prompt({ title = 'Eingabe', message = '', label = '', placeholder = '', value = '', confirmText = 'Speichern', cancelText = 'Abbrechen', required = true, trim = true } = {}){
        const result = await open({ title, message, label, placeholder, value, confirmText, cancelText, mode: 'prompt', required, trim });
        return result;
      },
      async select({ title = 'Auswahl', message = '', options = [], cancelText = 'Abbrechen', allowNone = true } = {}){
        const result = await open({ title, message, options, cancelText, mode: 'select', showCancel: allowNone, cancelResult: undefined });
        return result;
      }
    };
  }

  window.dialog = createDialog();
})();
