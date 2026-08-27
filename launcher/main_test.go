package main

import (
	"io/fs"
	"net/http"
	"net/http/httptest"
	"path"
	"strings"
	"testing"
)

func TestHandler(t *testing.T) {
	wwwFS, err := fs.Sub(embeddedFiles, "www")
	if err != nil {
		t.Fatalf("sub www error: %v", err)
	}

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cleanPath := path.Clean(r.URL.Path)
		reqPath := strings.TrimPrefix(cleanPath, "/")
		if reqPath == "" || reqPath == "." {
			reqPath = "index.html"
		}

		data, err := fs.ReadFile(wwwFS, reqPath)
		if err != nil {
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

	// Test root
	req := httptest.NewRequest("GET", "/", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200 for /, got %d", w.Code)
	}

	// Test assets if available
	if entries, err := fs.ReadDir(wwwFS, "assets"); err == nil && len(entries) > 0 {
		assetName := entries[0].Name()
		req = httptest.NewRequest("GET", "/assets/"+assetName, nil)
		w = httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Errorf("expected 200 for /assets/%s, got %d", assetName, w.Code)
		}
	}
}
