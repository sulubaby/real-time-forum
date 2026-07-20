package handlers

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"strings"
)

type bufferedResponse struct {
	header      http.Header
	body        bytes.Buffer
	status      int
	wroteHeader bool
}

func newBufferedResponse() *bufferedResponse {
	return &bufferedResponse{header: make(http.Header), status: http.StatusOK}
}

func (r *bufferedResponse) Header() http.Header { return r.header }

func (r *bufferedResponse) WriteHeader(status int) {
	if r.wroteHeader {
		return
	}
	r.status = status
	r.wroteHeader = true
}

func (r *bufferedResponse) Write(data []byte) (int, error) {
	if !r.wroteHeader {
		r.WriteHeader(http.StatusOK)
	}
	return r.body.Write(data)
}

func APIHandler(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		buffered := newBufferedResponse()
		defer func() {
			if recovered := recover(); recovered != nil {
				log.Printf("api panic on %s %s: %v", r.Method, r.URL.Path, recovered)
				writeAPIResponse(w, http.StatusInternalServerError, nil, "Something went wrong on the server")
				return
			}
			if buffered.status >= http.StatusBadRequest {
				message := strings.TrimSpace(buffered.body.String())
				var existing map[string]interface{}
				if json.Unmarshal(buffered.body.Bytes(), &existing) == nil {
					if value, ok := existing["error"].(string); ok {
						message = value
					} else if value, ok := existing["message"].(string); ok {
						message = value
					}
				}
				message = strings.TrimSpace(message)
				if message == "" {
					message = http.StatusText(buffered.status)
				}
				writeAPIResponse(w, buffered.status, nil, message)
				return
			}
			for key, values := range buffered.header {
				for _, value := range values {
					w.Header().Add(key, value)
				}
			}
			w.WriteHeader(buffered.status)
			_, _ = w.Write(buffered.body.Bytes())
		}()
		next(buffered, r)
	}
}

func writeAPIResponse(w http.ResponseWriter, status int, data interface{}, errorMessage string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if errorMessage != "" {
		_ = json.NewEncoder(w).Encode(map[string]string{"error": errorMessage})
		return
	}
	_ = json.NewEncoder(w).Encode(data)
}
