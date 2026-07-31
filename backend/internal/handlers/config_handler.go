package handlers

var appConfig *AppConfig

type AppConfig struct {
	DustThreshold        float64
	FocusAssetsWhitelist []string
}

func SetAppConfig(cfg *AppConfig) {
	appConfig = cfg
}

func GetAppConfig() *AppConfig {
	return appConfig
}
