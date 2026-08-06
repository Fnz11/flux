package middleware

import (
	"errors"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	httpRequestsTotal = prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "http_requests_total",
		Help: "Total number of HTTP requests processed by the API.",
	}, []string{"method", "status", "handler"})

	httpRequestDuration = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "http_request_duration_seconds",
		Help:    "HTTP request latency in seconds.",
		Buckets: prometheus.DefBuckets,
	}, []string{"method", "handler"})
)

// registerMetrics registers the request metrics with the default registerer.
// Registration is idempotent: a duplicate registration (e.g. from a second
// router.Setup call in a test) is tolerated via AlreadyRegisteredError.
func registerMetrics() {
	for _, collector := range []prometheus.Collector{httpRequestsTotal, httpRequestDuration} {
		if err := prometheus.DefaultRegisterer.Register(collector); err != nil {
			var already prometheus.AlreadyRegisteredError
			if errors.As(err, &already) {
				continue
			}
		}
	}
}

// PrometheusMiddleware records a per-request counter (method, status, handler)
// and a latency histogram for every request that passes through it.
func PrometheusMiddleware() gin.HandlerFunc {
	registerMetrics()
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		status := strconv.Itoa(c.Writer.Status())
		handler := c.FullPath()
		httpRequestsTotal.WithLabelValues(c.Request.Method, status, handler).Inc()
		httpRequestDuration.WithLabelValues(c.Request.Method, handler).Observe(time.Since(start).Seconds())
	}
}

// MetricsHandler serves the Prometheus scrape endpoint using the default
// gatherer so every registered collector (including this middleware's) is
// exposed at /metrics.
func MetricsHandler() gin.HandlerFunc {
	handler := promhttp.HandlerFor(prometheus.DefaultGatherer, promhttp.HandlerOpts{})
	return func(c *gin.Context) {
		handler.ServeHTTP(c.Writer, c.Request)
	}
}
