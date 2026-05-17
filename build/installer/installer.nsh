; Alpha — branded NSIS wizard (electron-builder custom macros)

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Installation d'Alpha"
  !define MUI_WELCOMEPAGE_TEXT "Ce programme installe Alpha, votre système de gestion d'entreprise (inventaire, ventes, achats, documents).$\r$\n$\r$\nNous vous recommandons de fermer les autres applications avant de continuer.$\r$\n$\r$\nCliquez sur Suivant pour poursuivre."
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customFinishPage
  !define MUI_FINISHPAGE_TITLE "Installation terminée"
  !define MUI_FINISHPAGE_TEXT "Alpha a été installé avec succès sur cet ordinateur.$\r$\n$\r$\nVous pouvez lancer l'application dès maintenant."
  !define MUI_FINISHPAGE_RUN
  !define MUI_FINISHPAGE_RUN_TEXT "Lancer Alpha"
  !insertmacro MUI_PAGE_FINISH
!macroend

!macro customUnWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Désinstallation d'Alpha"
  !define MUI_WELCOMEPAGE_TEXT "Ce programme va retirer Alpha de votre ordinateur.$\r$\n$\r$\nCliquez sur Suivant pour continuer."
  !insertmacro MUI_UNPAGE_WELCOME
!macroend

!macro customUnFinishPage
  !define MUI_FINISHPAGE_TITLE "Désinstallation terminée"
  !define MUI_FINISHPAGE_TEXT "Alpha a été retiré de votre ordinateur."
  !insertmacro MUI_UNPAGE_FINISH
!macroend
