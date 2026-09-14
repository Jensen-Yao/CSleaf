' CSleaf silent launcher — double-click to start & open in browser
' Works from any location; uses the folder this script lives in.
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = fso.GetParentFolderName(WScript.ScriptFullName)

' if CSleaf is already running, just open the browser
Dim running : running = False
On Error Resume Next
Dim http : Set http = CreateObject("MSXML2.XMLHTTP")
http.open "GET", "http://127.0.0.1:4513/api/projects", False
http.send
If Err.Number = 0 And http.status = 200 Then running = True
On Error GoTo 0

If Not running Then
  shell.Run "cmd /c npm start", 0, False   ' hidden window
  WScript.Sleep 4000                        ' give the server a moment
End If

shell.Run "cmd /c start """" http://127.0.0.1:4513", 0, False
