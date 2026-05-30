; Cleanup legacy shortcuts and install folders from older branding / custom installer.
!macro customInstall
  !ifdef BUILD_UNINSTALLER
  !else
    Delete "$DESKTOP\GroSafe.lnk"
    Delete "$DESKTOP\GroSafe Inventory Hub.lnk"
    Delete "$DESKTOP\Alpha Installer.lnk"
    Delete "$DESKTOP\Grosafe.lnk"

    RMDir /r /REBOOTOK "$SMPROGRAMS\GroSafe"
    RMDir /r /REBOOTOK "$SMPROGRAMS\GroSafe Inventory Hub"
    RMDir /r /REBOOTOK "$SMPROGRAMS\Alpha Installer"
    Delete "$SMPROGRAMS\GroSafe.lnk"
    Delete "$SMPROGRAMS\GroSafe Inventory Hub.lnk"
    Delete "$SMPROGRAMS\Alpha Installer.lnk"
    Delete "$SMPROGRAMS\Grosafe.lnk"

    RMDir /r /REBOOTOK "$LOCALAPPDATA\Programs\GroSafe"
    RMDir /r /REBOOTOK "$LOCALAPPDATA\Programs\GroSafe Inventory Hub"
    RMDir /r /REBOOTOK "$LOCALAPPDATA\Programs\Alpha Installer"
    RMDir /r /REBOOTOK "$LOCALAPPDATA\Programs\Grosafe"

    RMDir /r /REBOOTOK "$PROGRAMFILES\GroSafe"
    RMDir /r /REBOOTOK "$PROGRAMFILES\GroSafe Inventory Hub"
    RMDir /r /REBOOTOK "$PROGRAMFILES\Alpha Installer"
    RMDir /r /REBOOTOK "$PROGRAMFILES\Grosafe"
  !endif
!macroend
