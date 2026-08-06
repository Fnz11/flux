package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	jsoniter "github.com/json-iterator/go"
)

var jsonAPI = jsoniter.ConfigCompatibleWithStandardLibrary

type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}

type PaginatedData struct {
	Items interface{} `json:"items"`
	Total int         `json:"total"`
	Page  int         `json:"page"`
	Limit int         `json:"limit"`
}

func writeJSON(c *gin.Context, code int, v interface{}) {
	buf, err := jsonAPI.Marshal(v)
	if err != nil {
		_ = c.AbortWithError(http.StatusInternalServerError, err)
		return
	}
	c.Data(code, "application/json; charset=utf-8", buf)
}

func SuccessResponse(c *gin.Context, data interface{}) {
	writeJSON(c, http.StatusOK, APIResponse{Success: true, Data: data})
}

func ErrorResponse(c *gin.Context, status int, message string) {
	writeJSON(c, status, APIResponse{Success: false, Error: message})
}

// APIError pairs a machine-readable error code with a human-readable message
// (audit 2.7).
type APIError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// Structured error codes exposed to clients. Keep them stable: once shipped,
// changing a code breaks clients that switch on it.
const (
	ErrorCodeInvalidRequest = "INVALID_REQUEST"
	ErrorCodeNotFound       = "NOT_FOUND"
	ErrorCodeRateLimited    = "RATE_LIMITED"
	ErrorCodeTimeout        = "REQUEST_TIMEOUT"

	ErrorCodeAlreadySynced      = "TRADE_ALREADY_SYNCED"
	ErrorCodeInsufficientShares = "INSUFFICIENT_SHARES"
)

// ErrorCodeResponse writes a structured error payload of the form
// {"success":false,"code":code,"message":message}.
func ErrorCodeResponse(c *gin.Context, status int, code, message string) {
	writeJSON(c, status, gin.H{
		"success": false,
		"code":    code,
		"message": message,
	})
}

func PaginatedResponse(c *gin.Context, data interface{}, total int, page int, limit int) {
	writeJSON(c, http.StatusOK, APIResponse{
		Success: true,
		Data: PaginatedData{
			Items: data,
			Total: total,
			Page:  page,
			Limit: limit,
		},
	})
}

func IsValidWalletAddress(addr string) bool {
	return len(addr) >= 32 && len(addr) <= 44
}
