' Lanza el barrido de ventas vencidas sin mostrar la ventana de CMD.
' Tarea: \Corralon\CancelarVentasVencidas
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run """C:\Users\Fernando\Desktop\corralon_projest\scripts\cancelar_ventas_vencidas.bat""", 0, False
