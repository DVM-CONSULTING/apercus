/*
 * Kit Belle Devanture — partie « navigateur » pour un site statique sans Astro.
 * Transcription fidèle, sans changement de logique, des composants du dépôt :
 *   · kit/astro/Signature.astro     → année automatique ([data-annee]) ;
 *   · kit/astro/Consentement.astro  → bandeau cookies (Refuser = Accepter, choix gardé 6 mois) ;
 *   · kit/astro/GererCookies.astro  → boutons [data-bd-cookies] ;
 *   · kit/astro/envoi-formulaire.ts → envoi au service de réception, bdFormSent / bdFormFailed.
 * Le kit de mesure lui-même (kit/kit-bd-v2.html) est copié tel quel dans le <head> de chaque page.
 * Le habillage se règle par les variables --bd-* (assets/bd-kit.css).
 */
(function () {
  /* --- Signature : année automatique ------------------------------------- */
  document.querySelectorAll('[data-annee]').forEach(function (e) {
    e.textContent = String(new Date().getFullYear());
  });

  /* --- Bandeau de consentement ------------------------------------------- */
  var CLE = 'bd-consentement';
  var DUREE_MS = 1000 * 60 * 60 * 24 * 182; // ≈ 6 mois (recommandation CNIL)
  var bandeau = document.querySelector('[data-bd-consentement]');
  // Sans identifiant de mesure valide (G-…), rien n'est transmis à Google, même après « Accepter ».
  var mesureActive = !!(bandeau && /^G-[A-Z0-9]{4,}$/.test(bandeau.dataset.mesure || ''));

  function lire() {
    try {
      var brut = localStorage.getItem(CLE);
      if (!brut) return null;
      var v = JSON.parse(brut);
      if ((v.choix !== 'accepte' && v.choix !== 'refuse') || typeof v.date !== 'number') return null;
      if (Date.now() - v.date > DUREE_MS) return null;
      return v.choix;
    } catch (e) {
      return null;
    }
  }
  function ecrire(choix) {
    try {
      localStorage.setItem(CLE, JSON.stringify({ choix: choix, date: Date.now() }));
    } catch (e) {
      /* stockage bloqué : le choix vaut pour cette page seulement */
    }
  }
  function transmettreAccord() {
    if (mesureActive && typeof window.bdAnalyticsConsent === 'function') window.bdAnalyticsConsent();
  }
  function retirerAccord() {
    if (typeof window.bdAnalyticsRevoke === 'function') window.bdAnalyticsRevoke();
  }
  function placer() {
    if (!bandeau || bandeau.hidden) return;
    var barre = document.querySelector(bandeau.dataset.barreAppel || '.barre-appel');
    var visible = barre !== null && getComputedStyle(barre).display !== 'none';
    var hauteur = visible ? barre.getBoundingClientRect().height : 0;
    bandeau.style.insetBlockEnd = 'calc(' + Math.ceil(hauteur) + 'px + 0.75rem)';
  }
  function montrer() {
    if (!bandeau) return;
    bandeau.hidden = false;
    placer();
  }
  function ouvrir() {
    if (!bandeau) return;
    montrer();
    var refuser = bandeau.querySelector('[data-choix="refuse"]');
    if (refuser) refuser.focus();
  }
  if (bandeau) {
    var precedent = lire();
    if (precedent === 'accepte') transmettreAccord();
    if (precedent === null) montrer();
    window.addEventListener('resize', placer, { passive: true });
    bandeau.addEventListener('click', function (evenement) {
      var cible = evenement.target.closest('[data-choix]');
      if (!cible) return;
      var choix = cible.dataset.choix;
      var avant = lire();
      ecrire(choix);
      bandeau.hidden = true;
      if (choix === 'accepte') transmettreAccord();
      else if (avant === 'accepte') retirerAccord();
    });
    document.querySelectorAll('[data-bd-cookies]').forEach(function (lien) {
      lien.addEventListener('click', ouvrir);
    });
  }

  /* --- Formulaire : envoi au service de réception ------------------------ */
  var CHAMPS_DU_SERVICE = ['nom', 'telephone', 'email', 'message', 'site_web'];
  function libelle(form, nom) {
    var champ = form.querySelector('[name="' + CSS.escape(nom) + '"]');
    var groupe = champ && champ.type === 'radio' ? champ.closest('fieldset') : null;
    if (groupe && groupe.querySelector('legend')) return groupe.querySelector('legend').textContent.replace(/[\s*]+$/, '').trim();
    var lie = champ && champ.id ? form.querySelector('label[for="' + CSS.escape(champ.id) + '"]') : null;
    var source = lie || (champ && champ.closest('label'));
    var texte = source ? source.textContent.replace(/\s+/g, ' ').trim() : '';
    return texte || (champ && champ.getAttribute('aria-label')) || nom;
  }
  /** Corps envoyé : les champs du service, et les autres joints au message. */
  function corpsDemande(form) {
    var corps = new URLSearchParams();
    var vus = new Map();
    new FormData(form).forEach(function (valeur, cle) {
      var v = String(valeur).trim();
      if (cle.charAt(0) === '_' || CHAMPS_DU_SERVICE.indexOf(cle) >= 0) corps.append(cle, String(valeur));
      else if (v) vus.set(cle, (vus.get(cle) || []).concat(v));
    });
    var extras = [];
    vus.forEach(function (valeurs, cle) { extras.push(libelle(form, cle) + ' : ' + valeurs.join(', ')); });
    if (extras.length > 0) {
      var message = corps.get('message') || '';
      corps.set('message', extras.join('\n') + (message ? '\n\n' + message : ''));
    }
    return corps;
  }
  /**
   * Envoie le formulaire à son service (data-endpoint). bdFormSent SEULEMENT après la vraie
   * réponse positive ({ ok: true }), bdFormFailed sur tout échec. Renvoie true si c'est parti.
   */
  window.bdEnvoyerFormulaire = function (form) {
    var NOM = form.dataset.bdForm || 'contact';
    return fetch(form.dataset.endpoint, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: corpsDemande(form),
    })
      .then(function (reponse) {
        return reponse.json().catch(function () { return null; }).then(function (donnees) {
          if (reponse.ok && donnees && donnees.ok === true) {
            if (typeof window.bdFormSent === 'function') window.bdFormSent(NOM);
            return { ok: true, erreurs: [] };
          }
          if (typeof window.bdFormFailed === 'function') window.bdFormFailed(NOM);
          var erreurs = donnees && Array.isArray(donnees.erreurs) ? donnees.erreurs.filter(function (e) { return typeof e === 'string'; }) : [];
          return { ok: false, erreurs: erreurs };
        });
      })
      .catch(function () {
        if (typeof window.bdFormFailed === 'function') window.bdFormFailed(NOM);
        return { ok: false, erreurs: [] };
      });
  };
})();
