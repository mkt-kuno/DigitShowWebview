package main

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

//go:embed all:www
var embeddedFiles embed.FS

var mimeTypes = map[string]string{
	".html":  "text/html; charset=utf-8",
	".js":    "application/javascript; charset=utf-8",
	".mjs":   "application/javascript; charset=utf-8",
	".css":   "text/css; charset=utf-8",
	".json":  "application/json; charset=utf-8",
	".svg":   "image/svg+xml",
	".png":   "image/png",
	".jpg":   "image/jpeg",
	".jpeg":  "image/jpeg",
	".gif":   "image/gif",
	".webp":  "image/webp",
	".ico":   "image/x-icon",
	".woff":  "font/woff",
	".woff2": "font/woff2",
	".ttf":   "font/ttf",
	".txt":   "text/plain; charset=utf-8",
	".map":   "application/json; charset=utf-8",
}

func getMimeType(filePath string) string {
	ext := strings.ToLower(path.Ext(filePath))
	if mime, ok := mimeTypes[ext]; ok {
		return mime
	}
	return "application/octet-stream"
}

func findBrowser() (string, bool) {
	switch runtime.GOOS {
	case "windows":
		localAppData := os.Getenv("LOCALAPPDATA")
		programFiles := os.Getenv("ProgramFiles")
		programFilesX86 := os.Getenv("ProgramFiles(x86)")

		candidates := []string{
			filepath.Join(programFilesX86, "Microsoft", "Edge", "Application", "msedge.exe"),
			filepath.Join(programFiles, "Microsoft", "Edge", "Application", "msedge.exe"),
			filepath.Join(localAppData, "Microsoft", "Edge", "Application", "msedge.exe"),
			filepath.Join(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
			filepath.Join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
			filepath.Join(localAppData, "Google", "Chrome", "Application", "chrome.exe"),
		}

		for _, p := range candidates {
			if p != "" {
				if _, err := os.Stat(p); err == nil {
					return p, true
				}
			}
		}

		if p, err := exec.LookPath("msedge.exe"); err == nil {
			return p, true
		}
		if p, err := exec.LookPath("chrome.exe"); err == nil {
			return p, true
		}

	case "darwin":
		candidates := []string{
			"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
			"/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
			"/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
			"/Applications/Chromium.app/Contents/MacOS/Chromium",
		}
		for _, p := range candidates {
			if _, err := os.Stat(p); err == nil {
				return p, true
			}
		}
		if p, err := exec.LookPath("google-chrome"); err == nil {
			return p, true
		}

	case "linux":
		candidates := []string{
			"google-chrome",
			"google-chrome-stable",
			"chromium",
			"chromium-browser",
			"brave-browser",
			"microsoft-edge",
			"microsoft-edge-stable",
		}
		for _, name := range candidates {
			if p, err := exec.LookPath(name); err == nil {
				return p, true
			}
		}
	}

	return "", false
}

func openDefaultBrowser(url string) *exec.Cmd {
	switch runtime.GOOS {
	case "windows":
		return exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	case "darwin":
		return exec.Command("open", url)
	default:
		return exec.Command("xdg-open", url)
	}
}

func getProfileDir() string {
	configDir, err := os.UserConfigDir()
	if err != nil || configDir == "" {
		configDir = os.TempDir()
	}
	dir := filepath.Join(configDir, "DigitShowWebview", "profile")
	_ = os.MkdirAll(dir, 0755)
	return dir
}

func main() {
	wwwFS, err := fs.Sub(embeddedFiles, "www")
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to sub www: %v\n", err)
		os.Exit(1)
	}

	// Try default port 8088 first, then fallback to any open port
	var listener net.Listener
	listener, err = net.Listen("tcp", "127.0.0.1:8088")
	if err != nil {
		listener, err = net.Listen("tcp", "127.0.0.1:0")
		if err != nil {
			fmt.Fprintf(os.Stderr, "failed to bind 127.0.0.1: %v\n", err)
			os.Exit(1)
		}
	}
	defer listener.Close()

	port := listener.Addr().(*net.TCPAddr).Port
	appURL := fmt.Sprintf("http://127.0.0.1:%d", port)

	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		cleanPath := path.Clean(r.URL.Path)
		reqPath := strings.TrimPrefix(cleanPath, "/")
		if reqPath == "" || reqPath == "." {
			reqPath = "index.html"
		}

		// Try reading direct file from embed.FS
		data, err := fs.ReadFile(wwwFS, reqPath)
		if err != nil {
			// SPA fallback: if not a direct file request with an extension, serve index.html
			base := path.Base(reqPath)
			if !strings.Contains(base, ".") {
				data, err = fs.ReadFile(wwwFS, "index.html")
				reqPath = "index.html"
			}
		}

		if err != nil {
			http.NotFound(w, r)
			return
		}

		w.Header().Set("Content-Type", getMimeType(reqPath))
		w.Header().Set("Cache-Control", "no-cache")
		w.Write(data)
	})

	server := &http.Server{
		Handler: mux,
	}

	// Start server in background
	go func() {
		if err := server.Serve(listener); err != nil && err != http.ErrServerClosed {
			fmt.Fprintf(os.Stderr, "HTTP server error: %v\n", err)
		}
	}()

	profileDir := getProfileDir()

	browserPath, found := findBrowser()
	if found {
		cmd := exec.Command(
			browserPath,
			"--app="+appURL,
			"--user-data-dir="+profileDir,
			"--window-size=1280,800",
			"--no-first-run",
			"--no-default-browser-check",
		)
		// Run browser and wait until closed
		_ = cmd.Run()
	} else {
		// Fallback: open default browser
		cmd := openDefaultBrowser(appURL)
		_ = cmd.Start()
		select {}
	}

	// Graceful shutdown after browser window is closed
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	_ = server.Shutdown(ctx)
}
