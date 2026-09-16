!macro customUnInstall
  ; Do NOT delete user data (database, logs, config) on uninstall
  ; User data is in %APPDATA%\MERQO RetailOS or %APPDATA%\merqo-retailos
  ; Protect business data from accidental deletion
  ; Only remove app files, not user data
  
  ; MessageBox to warn if user wants to remove data (optional future)
  ; For now, we explicitly do NOT delete appdata
  
  ; The following would be dangerous - DO NOT UNCOMMENT:
  ; RMDir /r "$APPDATA\MERQO RetailOS"
  ; RMDir /r "$APPDATA\merqo-retailos"
  
  ; Log that we preserved user data
  DetailPrint "Preserving user data in $APPDATA - database, logs, config remain"
!macroend

!macro customInstall
  ; Ensure user data directory exists (will be created by app, but we can pre-create)
  DetailPrint "MERQO RetailOS will store data in %APPDATA%\MERQO RetailOS"
!macroend
