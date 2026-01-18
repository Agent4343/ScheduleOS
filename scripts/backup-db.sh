#!/bin/bash
#
# ScheduleOS Database Backup Script
#
# This script creates a compressed backup of the PostgreSQL database.
# It can be run manually or scheduled via cron.
#
# Usage: ./scripts/backup-db.sh [options]
#   -d, --dir       Backup directory (default: ./backups)
#   -r, --retain    Number of backups to retain (default: 7)
#   -c, --compress  Compression level 0-9 (default: 6)
#   -h, --help      Show this help message
#
# Environment Variables:
#   DATABASE_URL    PostgreSQL connection string (required)
#   BACKUP_DIR      Override default backup directory
#   BACKUP_RETAIN   Override default retention count
#
# Cron Example (daily at 2 AM):
#   0 2 * * * /path/to/scheduleos/scripts/backup-db.sh >> /var/log/scheduleos-backup.log 2>&1

set -euo pipefail

# Default configuration
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETAIN_COUNT="${BACKUP_RETAIN:-7}"
COMPRESS_LEVEL=6
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="scheduleos_backup_${TIMESTAMP}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" >&2
}

# Show help
show_help() {
    head -25 "$0" | tail -20
    exit 0
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--dir)
            BACKUP_DIR="$2"
            shift 2
            ;;
        -r|--retain)
            RETAIN_COUNT="$2"
            shift 2
            ;;
        -c|--compress)
            COMPRESS_LEVEL="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Check for required environment variable
if [[ -z "${DATABASE_URL:-}" ]]; then
    log_error "DATABASE_URL environment variable is not set"
    log_error "Please set DATABASE_URL or create a .env file"
    exit 1
fi

# Load .env file if it exists
if [[ -f ".env" ]]; then
    export $(grep -v '^#' .env | xargs)
fi

# Parse DATABASE_URL
# Format: postgresql://user:password@host:port/database
parse_db_url() {
    local url="$1"

    # Remove protocol
    url="${url#postgresql://}"
    url="${url#postgres://}"

    # Extract user:password
    local userpass="${url%%@*}"
    DB_USER="${userpass%%:*}"
    DB_PASS="${userpass#*:}"

    # Extract host:port/database
    local hostportdb="${url#*@}"
    local hostport="${hostportdb%%/*}"
    DB_HOST="${hostport%%:*}"
    DB_PORT="${hostport#*:}"

    # Handle case where port is not specified
    if [[ "$DB_PORT" == "$DB_HOST" ]]; then
        DB_PORT="5432"
    fi

    # Extract database name (remove query string if present)
    DB_NAME="${hostportdb#*/}"
    DB_NAME="${DB_NAME%%\?*}"
}

# Create backup directory if it doesn't exist
create_backup_dir() {
    if [[ ! -d "$BACKUP_DIR" ]]; then
        log_info "Creating backup directory: $BACKUP_DIR"
        mkdir -p "$BACKUP_DIR"
    fi
}

# Perform the backup
perform_backup() {
    local backup_file="${BACKUP_DIR}/${BACKUP_NAME}.sql.gz"

    log_info "Starting database backup..."
    log_info "Database: $DB_NAME @ $DB_HOST:$DB_PORT"
    log_info "Backup file: $backup_file"

    # Set password for pg_dump
    export PGPASSWORD="$DB_PASS"

    # Perform backup with compression
    if pg_dump \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --no-owner \
        --no-acl \
        --clean \
        --if-exists \
        | gzip -"$COMPRESS_LEVEL" > "$backup_file"; then

        unset PGPASSWORD

        local size=$(du -h "$backup_file" | cut -f1)
        log_info "Backup completed successfully!"
        log_info "Backup size: $size"

        # Create a latest symlink
        ln -sf "${BACKUP_NAME}.sql.gz" "${BACKUP_DIR}/latest.sql.gz"

        return 0
    else
        unset PGPASSWORD
        log_error "Backup failed!"
        rm -f "$backup_file"
        return 1
    fi
}

# Clean up old backups
cleanup_old_backups() {
    log_info "Cleaning up old backups (retaining last $RETAIN_COUNT)..."

    local backup_count=$(ls -1 "${BACKUP_DIR}"/scheduleos_backup_*.sql.gz 2>/dev/null | wc -l)

    if [[ $backup_count -gt $RETAIN_COUNT ]]; then
        local to_delete=$((backup_count - RETAIN_COUNT))
        log_info "Removing $to_delete old backup(s)..."

        ls -1t "${BACKUP_DIR}"/scheduleos_backup_*.sql.gz | tail -n "$to_delete" | while read -r file; do
            log_info "Deleting: $(basename "$file")"
            rm -f "$file"
        done
    else
        log_info "No old backups to remove"
    fi
}

# Verify backup integrity
verify_backup() {
    local backup_file="${BACKUP_DIR}/${BACKUP_NAME}.sql.gz"

    log_info "Verifying backup integrity..."

    if gzip -t "$backup_file" 2>/dev/null; then
        log_info "Backup integrity verified"
        return 0
    else
        log_error "Backup integrity check failed!"
        return 1
    fi
}

# Main execution
main() {
    log_info "=========================================="
    log_info "ScheduleOS Database Backup"
    log_info "=========================================="

    parse_db_url "$DATABASE_URL"
    create_backup_dir

    if perform_backup; then
        verify_backup
        cleanup_old_backups

        log_info "=========================================="
        log_info "Backup process completed successfully!"
        log_info "=========================================="
        exit 0
    else
        log_error "=========================================="
        log_error "Backup process failed!"
        log_error "=========================================="
        exit 1
    fi
}

main
