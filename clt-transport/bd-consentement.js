/*
 * Kit Belle Devanture — bandeau de consentement (PRIV-COOKIE-01).
 * Portage en JavaScript simple de kit/astro/Consentement.astro : Refuser au même
 * niveau qu'Accepter, rien de précoché, choix gardé 6 mois puis redemandé,
 * modifiable à tout moment par « Gérer mes cookies » ([data-bd-cookies]).
 * Transmet l'accord au kit de mesure (bdAnalyticsConsent / bdAnalyticsRevoke).
 * Posé seulement quand le site mesure (node tools/kit.mjs --mesure G-…).
 */
(function () {
  var CLE = 'bd-consentement';
  var DUREE_MS = 1000 * 60 * 60 * 24 * 182; // ≈ 6 mois (recommandation CNIL)

  function lire() {
    try {
      var brut = localStorage.getItem(CLE);
      if (!brut) return null;
      var v = JSON.parse(brut);
      if ((v.choix !== 'accepte' && v.choix !== 'refuse') || typeof v.date !== 'number') return null;
      if (Date.now() - v.date > DUREE_MS) return null;
      return v.choix;
    } catch (e) { return null; }
  }
  function ecrire(choix) {
    try { localStorage.setItem(CLE, JSON.stringify({ choix: choix, date: Date.now() })); } catch (e) { /* choix valable pour cette page */ }
  }
  function transmettreAccord() { if (typeof window.bdAnalyticsConsent === 'function') window.bdAnalyticsConsent(); }
  function retirerAccord() { if (typeof window.bdAnalyticsRevoke === 'function') window.bdAnalyticsRevoke(); }

  var bandeau = document.querySelector('[data-bd-consentement]');
  if (!bandeau) return;

  function placer() {
    if (bandeau.hidden) return;
    var barre = document.querySelector(bandeau.getAttribute('data-barre-appel') || '.barre-appel');
    var visible = barre !== null && getComputedStyle(barre).display !== 'none';
    var hauteur = visible ? barre.getBoundingClientRect().height : 0;
    bandeau.style.insetBlockEnd = 'calc(' + Math.ceil(hauteur) + 'px + 0.75rem)';
  }
  function montrer() { bandeau.hidden = false; placer(); }
  function ouvrir() {
    montrer();
    var refuser = bandeau.querySelector('[data-choix="refuse"]');
    if (refuser) refuser.focus();
  }

  var precedent = lire();
  if (precedent === 'accepte') transmettreAccord();
  if (precedent === null) montrer();
  window.addEventListener('resize', placer, { passive: true });

  bandeau.addEventListener('click', function (evenement) {
    var cible = evenement.target.closest('[data-choix]');
    if (!cible) return;
    var choix = cible.getAttribute('data-choix');
    var avant = lire();
    ecrire(choix);
    bandeau.hidden = true;
    if (choix === 'accepte') transmettreAccord();
    else if (avant === 'accepte') retirerAccord();
  });

  document.querySelectorAll('[data-bd-cookies]').forEach(function (lien) {
    lien.addEventListener('click', ouvrir);
  });
})();
