#include <windows.h>
#include <shellapi.h>

NOTIFYICONDATA nid;
HMENU hMenu;
UINT_PTR nextMenuId = 1;

void reportClick(UINT_PTR menuId);

void addMenuItem(UINT_PTR menuId, const char* title) {
	AppendMenu(hMenu, MF_STRING, menuId, title);
}

void setTrayIcon(const char* tooltip, HICON icon) {
	nid.cbSize = sizeof(NOTIFYICONDATA);
	nid.hWnd = GetConsoleWindow();
	nid.uID = 1;
	nid.uFlags = NIF_MESSAGE | NIF_ICON | NIF_TIP;
	nid.uCallbackMessage = WM_APP + 1;
	strncpy(nid.szTip, tooltip, sizeof(nid.szTip) / sizeof(*nid.szTip));
	nid.hIcon = icon;
	Shell_NotifyIcon(NIM_ADD, &nid);
}

void removeTrayIcon() {
	Shell_NotifyIcon(NIM_DELETE, &nid);
}

void showMenu(HWND hwnd) {
	POINT p;
	GetCursorPos(&p);
	SetForegroundWindow(hwnd); // Set the foreground window before showing the menu for proper focus
	TrackPopupMenu(hMenu, TPM_BOTTOMALIGN | TPM_LEFTALIGN, p.x, p.y, 0, hwnd, NULL);
	PostMessage(hwnd, WM_NULL, 0, 0); // Post a null message to make the menu close properly
}

LRESULT CALLBACK WindowProc(HWND hwnd, UINT uMsg, WPARAM wParam, LPARAM lParam) {
	switch (uMsg) {
		case WM_APP + 1:
			if (lParam == WM_RBUTTONUP) {
				showMenu(hwnd);
			}
			break;
		case WM_COMMAND:
			if (lParam == 0) {
				reportClick(wParam);
			}
			break;
		case WM_DESTROY:
			PostQuitMessage(0);
			break;
		default:
			return DefWindowProc(hwnd, uMsg, wParam, lParam);
	}
	return 0;
}

HICON loadIcon(const char* iconName) {
	return (HICON)LoadImage(NULL, iconName, IMAGE_ICON, 32, 32, LR_LOADFROMFILE);
}

void init(const char* iconName, const char* tooltip) {
	hMenu = CreatePopupMenu();
	HICON icon = loadIcon(iconName);
	setTrayIcon(tooltip, icon);

	WNDCLASS wc = {0};
	wc.lpfnWndProc = WindowProc;
	wc.hInstance = GetModuleHandle(NULL);
	wc.lpszClassName = "WoxWindowClass";
	RegisterClass(&wc);

	HWND hwnd = CreateWindowEx(0, "WoxWindowClass", "Wox", WS_OVERLAPPEDWINDOW,
		CW_USEDEFAULT, CW_USEDEFAULT, CW_USEDEFAULT, CW_USEDEFAULT, NULL, NULL, wc.hInstance, NULL);
	nid.hWnd = hwnd;
	UpdateWindow(hwnd);
}