/*
 * Kit Belle Devanture — envoi suivi du formulaire (FUNC-FORM-01).
 * Portage en JavaScript simple de kit/astro/envoi-formulaire.ts (le site n'a
 * pas d'étape de compilation) ; même règles :
 *   · bdFormSent(nom) SEULEMENT après la vraie réponse positive ({ ok: true }) ;
 *   · bdFormFailed(nom) sur tout échec (refus, réseau, réponse illisible) ;
 *   · le service ne lit que nom, telephone, email, message (+ _slug, _ts,
 *     site_web) : les autres champs sont joints en tête du message.
 *
 * Tant que l'adresse du service n'est pas connue (data-endpoint vide), le
 * formulaire garde son fonctionnement actuel : app.js prépare un e-mail.
 */
(function (racine) {
  var CHAMPS_DU_SERVICE = { nom: 1, telephone: 1, email: 1, message: 1, site_web: 1 };

  function libelle(form, nom) {
    var champ = form.querySelector('[name="' + nom + '"]');
    // Choix en tuiles (boutons radio) : le titre du groupe, pas celui de la première tuile.
    var groupe = champ && (champ.type === 'radio' || champ.type === 'checkbox') && champ.closest ? champ.closest('fieldset') : null;
    var legende = groupe && groupe.querySelector('legend');
    if (legende) {
      var titre = legende.querySelector('.form-step-title');
      return String((titre || legende).textContent).replace(/\s+/g, ' ').replace(/\*/g, '').trim();
    }
    var lie = champ && champ.closest ? champ.closest('label') : null;
    var texte = lie ? lie.childNodes[0] && lie.childNodes[0].textContent : '';
    texte = String(texte || '').replace(/\s+/g, ' ').replace(/\*/g, '').trim();
    return texte || (champ && champ.getAttribute('aria-label')) || nom;
  }

  /** Corps envoyé : les champs du service, et les autres joints au message. */
  function corpsDemande(form, entrees) {
    var corps = new URLSearchParams();
    var extras = [];
    var vus = {};
    var ordre = [];
    (entrees || Array.from(new FormData(form))).forEach(function (paire) {
      var cle = paire[0];
      var valeur = String(paire[1]);
      if (cle.charAt(0) === '_' || CHAMPS_DU_SERVICE[cle]) corps.append(cle, valeur);
      else if (valeur.trim()) {
        if (!vus[cle]) { vus[cle] = []; ordre.push(cle); }
        vus[cle].push(valeur.trim());
      }
    });
    ordre.forEach(function (cle) { extras.push(libelle(form, cle) + ' : ' + vus[cle].join(', ')); });
    if (extras.length) {
      var message = corps.get('message') || '';
      corps.set('message', extras.join('\n') + (message ? '\n\n' + message : ''));
    }
    return corps;
  }

  /**
   * Envoie le formulaire au service et rend { ok, erreurs }.
   * Appelle bdFormSent / bdFormFailed du kit de mesure quand il est posé.
   */
  function envoyer(form, fetchFn) {
    var f = racine;
    var NOM = form.getAttribute('data-bd-form') || 'contact';
    var appel = fetchFn || racine.fetch;
    function echec(erreurs) {
      if (typeof f.bdFormFailed === 'function') f.bdFormFailed(NOM);
      return { ok: false, erreurs: erreurs };
    }
    return Promise.resolve()
      .then(function () {
        return appel(form.getAttribute('data-endpoint'), {
          method: 'POST',
          headers: { Accept: 'application/json' },
          body: corpsDemande(form),
        });
      })
      .then(function (reponse) {
        return reponse.json().catch(function () { return null; }).then(function (donnees) {
          if (reponse.ok && donnees && donnees.ok === true) {
            if (typeof f.bdFormSent === 'function') f.bdFormSent(NOM);
            return { ok: true, erreurs: [] };
          }
          var erreurs = donnees && Array.isArray(donnees.erreurs)
            ? donnees.erreurs.filter(function (e) { return typeof e === 'string'; })
            : [];
          return echec(erreurs);
        });
      })
      .catch(function () { return echec([]); });
  }

  racine.bdFormulaire = { corpsDemande: corpsDemande, envoyer: envoyer };
  if (typeof module !== 'undefined' && module.exports) module.exports = racine.bdFormulaire;
})(typeof window !== 'undefined' ? window : globalThis);
