SetFont "Segoe UI" 10
ManifestDPIAware true

!ifndef BUILD_UNINSTALLER
  Var setupTitleFont
  Var setupPromptFont
  !define MUI_CUSTOMFUNCTION_GUIINIT layoutHeader
  !macro customWelcomePage
    ; The first assisted page is electron-builder's account selector.
    !define MUI_PAGE_CUSTOMFUNCTION_SHOW layoutAccounts
  !macroend

  ; Declare the native directory page in the assisted wizard's custom-page slot
  ; so its SHOW callback can lay out the path field and Browse button together.
  !macro customPageAfterChangeDir
    !define MUI_PAGE_HEADER_TEXT "Where should I call home?"
    !define MUI_PAGE_HEADER_SUBTEXT "I'll use this folder, or you can pick another with Browse."
    !define MUI_DIRECTORYPAGE_TEXT_TOP " "
    !define MUI_DIRECTORYPAGE_TEXT_DESTINATION "Installation folder"
    !define MUI_PAGE_CUSTOMFUNCTION_SHOW layoutFolder
    !insertmacro skipPageIfUpdated
    !insertmacro MUI_PAGE_DIRECTORY
    ; NSIS commits $INSTDIR after leaving the directory page.
    !define MUI_PAGE_CUSTOMFUNCTION_PRE useAppSubfolder
    !define MUI_PAGE_HEADER_TEXT "I'm getting settled in"
    !define MUI_PAGE_HEADER_SUBTEXT "I'm putting my files in the folder you chose."
  !macroend

  !macro customFinishPage
    !define MUI_FINISHPAGE_TITLE "All set! Come say hi."
    !define MUI_FINISHPAGE_TEXT 'Someday, I’d love to run a few errands for you.$\r$\n$\r$\n•  Pick up your packages$\r$\n•  Bring milk tea to your study spot$\r$\n•  Deliver flowers to a friend$\r$\n$\r$\nOpen me from the Start menu and type “Hey CoCo!”'
    !define MUI_PAGE_CUSTOMFUNCTION_SHOW layoutFinish
    !insertmacro MUI_PAGE_FINISH
  !macroend
!endif

; Native and nsDialogs pages have different font metrics. Use the outer
; dialog's units for every page so the text column clears the illustration.
!macro placeControl control x y width height
  System::Store "S"
  System::Call '*(i ${x}, i ${y}, i ${width}, i ${height}) p.r0'
  System::Call 'user32::MapDialogRect(p $HWNDPARENT, p r0)'
  System::Call '*$0(i.r1, i.r2, i.r3, i.r4)'
  System::Free $0
  System::Call 'user32::MoveWindow(p ${control}, i r1, i r2, i r3, i r4, i 1)'
  System::Store "L"
!macroend

!macro customHeader
  !ifndef BUILD_UNINSTALLER
    ; Override the English strings provided by electron-builder for this page.
    !pragma warning push
    !pragma warning disable 6030
    LangString chooseInstallationOptions 1033 "Hi, I'm CoCo!"
    LangString whoShouldThisApplicationBeInstalledFor 1033 "Thanks for downloading me. I'm glad you're here."
    LangString selectUserMode 1033 "Who will I be helping on this PC?"
    LangString forAll 1033 "&Everyone on this PC"
    LangString onlyForMe 1033 "Just &me"
    LangString freshInstallForCurrent 1033 "Just you, then! You'll find me in your Start menu."
    LangString freshInstallForAll 1033 "I'll be in everyone's Start menu. Installing for all accounts needs administrator access."
    LangString perUserInstallExists 1033 "Looks like I'm already here on your account.$\r$\n"
    LangString perMachineInstallExists 1033 "Looks like I'm already here for everyone on this PC.$\r$\n"
    LangString reinstallUpgrade 1033 "I'll replace the existing copy when you install."
    !pragma warning pop

    Function layoutHeader
      CreateFont $setupTitleFont "Segoe UI" 16 600
      CreateFont $setupPromptFont "Segoe UI" 12 600
      SendMessage $mui.Header.Text ${WM_SETFONT} $setupTitleFont 1
      ${NSD_AddStyle} $mui.Header.Text ${SS_CENTERIMAGE}
      !insertmacro placeControl $mui.Header.Text 22 5 244 18
      !insertmacro placeControl $mui.Header.SubText 22 22 260 10
    FunctionEnd

    Function layoutAccounts
      SendMessage $MultiUser.InstallModePage.Text ${WM_SETFONT} $setupPromptFont 1
      !insertmacro placeControl $MultiUser.InstallModePage.Text 8 6 276 17
      !insertmacro placeControl $MultiUser.InstallModePage.AllUsers 8 27 276 18
      !insertmacro placeControl $MultiUser.InstallModePage.CurrentUser 8 49 276 18
      !insertmacro placeControl $RadioButtonLabel1 8 79 276 58
    FunctionEnd

    Function layoutFolder
      ShowWindow $mui.DirectoryPage.Text ${SW_HIDE}
      SendMessage $mui.DirectoryPage.DirectoryBox ${WM_SETFONT} $setupPromptFont 1
      !insertmacro placeControl $mui.DirectoryPage.DirectoryBox 8 12 276 44
      !insertmacro placeControl $mui.DirectoryPage.Directory 18 29 194 14
      !insertmacro placeControl $mui.DirectoryPage.BrowseButton 218 28 57 16
      !insertmacro placeControl $mui.DirectoryPage.SpaceRequired 8 70 276 13
      !insertmacro placeControl $mui.DirectoryPage.SpaceAvailable 8 83 276 13
    FunctionEnd

    !include StrContains.nsh
    Function useAppSubfolder
      ${StrContains} $0 "${APP_FILENAME}" $INSTDIR
      ${If} $0 == ""
        StrCpy $INSTDIR "$INSTDIR\${APP_FILENAME}"
      ${EndIf}
    FunctionEnd

    Function layoutFinish
      IfRebootFlag done
      SendMessage $mui.FinishPage.Title ${WM_SETFONT} $setupTitleFont 1
      !insertmacro placeControl $mui.FinishPage.Title 124 37 185 22
      !insertmacro placeControl $mui.FinishPage.Text 124 63 185 125
      done:
    FunctionEnd
  !endif
!macroend
