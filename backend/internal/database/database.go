package database

import (
	"fmt"
	"net/url"
	"os"
	"strings"
	"time"

	"backend/internal/config"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func Connect(cfg config.DatabaseConfig) (*gorm.DB, error) {
	dsn := buildDSN(cfg)

	gormCfg := &gorm.Config{
		PrepareStmt: true,
		Logger:      logger.Default.LogMode(logger.Warn),
	}
	if strings.EqualFold(os.Getenv("APP_ENV"), "production") ||
		strings.EqualFold(os.Getenv("GIN_MODE"), "release") {
		gormCfg.Logger = logger.Default.LogMode(logger.Error)
	}

	db, err := gorm.Open(postgres.Open(dsn), gormCfg)
	if err != nil {
		if strings.Contains(err.Error(), "SQLSTATE 28P01") {
			return nil, fmt.Errorf(
				"authentication failed for user=%s db=%s host=%s port=%s: %w",
				cfg.User,
				cfg.Name,
				cfg.Host,
				cfg.Port,
				err,
			)
		}

		return nil, fmt.Errorf(
			"database connection failed for user=%s db=%s host=%s port=%s: %w",
			cfg.User,
			cfg.Name,
			cfg.Host,
			cfg.Port,
			err,
		)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("sql db handle: %w", err)
	}
	// Keep pool small for Render free / Neon — prevents connection storms.
	sqlDB.SetMaxOpenConns(15)
	sqlDB.SetMaxIdleConns(5)
	sqlDB.SetConnMaxLifetime(30 * time.Minute)
	sqlDB.SetConnMaxIdleTime(5 * time.Minute)

	return db, nil
}

func buildDSN(cfg config.DatabaseConfig) string {
	password := url.QueryEscape(cfg.Password)
	return fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		cfg.Host,
		cfg.Port,
		cfg.User,
		password,
		cfg.Name,
		cfg.SSLMode,
	)
}
