; Use Tauri's supported include hook rather than forking its upgrade logic.
!define MUI_BGCOLOR "050505"
!define MUI_TEXTCOLOR "F2F5F0"
!define MUI_DIRECTORYPAGE_BGCOLOR "0B0C0B"
!define MUI_DIRECTORYPAGE_TEXTCOLOR "F2F5F0"
!define MUI_INSTFILESPAGE_COLORS "F2F5F0 0B0C0B"
!define MUI_CUSTOMFUNCTION_GUIINIT LHThemeInit
!define MUI_CUSTOMFUNCTION_UNGUIINIT un.LHThemeInit

InstallColors F2F5F0 0B0C0B

!macro LHThemeWindow
  SetCtlColors $HWNDPARENT F2F5F0 050505
  ; Branding text is outside the page container.
  Push $0
  GetDlgItem $0 $HWNDPARENT 1028
  SetCtlColors $0 949B95 050505
  Pop $0
!macroend

Function LHThemeInit
  !insertmacro LHThemeWindow
FunctionEnd

Function un.LHThemeInit
  !insertmacro LHThemeWindow
FunctionEnd
