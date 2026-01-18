#!/bin/bash
#
# ScheduleOS Database Restore Script
#
# This script restores a PostgreSQL database from a backup file.
#
# Usage: ./scripts/restore-db.sh [backup_file]
#   backup_file     Path to backup file (default: backups/latest.sql.gz)
#
# Options:
#   -f, --force     Skip confirmation prompt
#   -l, --list      List available backups
#   -h, --help      Show this help message
#
# Environment Variables:
#   DATABASE_URL    PostgreSQL connection string (required)
#
# WARNING: This will DROP and recreate all tables!

set -euo pipefail

# Default configuration
BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_FILE=""
FORCE=false

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
    head -20 "$0" | tail -16
    exit 0
}

# List available backups
list_backups() {
    log_info "Available backups in $BACKUP_DIR:"
    echo ""

    if [[ -d "$BACKUP_DIR" ]]; then
        ls -lh "${BACKUP_DIR}"/scheduleos_backup_*.sql.gz 2>/dev/null | while read -r line; do
            echo "  $line"
        done

        if [[ -L "${BACKUP_DIR}/latest.sql.gz" ]]; then
            echo ""
            echo "  Latest backup points to: $(readlink "${BACKUP_DIR}/latest.sql.gz")"
        fi
    else
        log_warn "Backup directory does not exist: $BACKUP_DIR"
    fi

    exit 0
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--force)
            FORCE=true
            shift
            ;;
        -l|--list)
            list_backups
            ;;
        -h|--help)
            show_help
            ;;
        -*)
            log_error "Unknown option: $1"
            exit 1
            ;;
        *)
            BACKUP_FILE="$1"
            shift
            ;;
    esac
done

# Check for required environment variable
if [[ -z "${DATABASE_URL:-}" ]]; then
    log_error "DATABASE_URL environment variable is not set"
    exit 1
fi

# Load .env file if it exists
if [[ -f ".env" ]]; then
    export $(grep -v '^#' .env | xargs)
fi

# Set default backup file
if [[ -z "$BACKUP_FILE" ]]; then
    BACKUP_FILE="${BACKUP_DIR}/latest.sql.gz"
fi

# Check if backup file exists
if [[ ! -f "$BACKUP_FILE" ]]; then
    log_error "Backup file not found: $BACKUP_FILE"
    log_info "Use -l to list available backups"
    exit 1
fi

# Parse DATABASE_URL
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

# Confirm restore
confirm_restore() {
    if [[ "$FORCE" == true ]]; then
        return 0
    fi

    echo ""
    log_warn "========================================"
    log_warn "          WARNING: DESTRUCTIVE OPERATION"
    log_warn "========================================"
    echo ""
    log_warn "This will restore the database from:"
    log_warn "  $BACKUP_FILE"
    echo ""
    log_warn "Target database:"
    log_warn "  $DB_NAME @ $DB_HOST:$DB_PORT"
    echo ""
    log_warn "ALL EXISTING DATA WILL BE OVERWRITTEN!"
    echo ""

    read -p "Are you sure you want to continue? (yes/no): " confirm

    if [[ "$confirm" != "yes" ]]; then
        log_info "Restore cancelled"
        exit 0
    fi
}

# Perform the restore
perform_restore() {
    log_info "Starting database restore..."
    log_info "Backup file: $BACKUP_FILE"
    log_info "Database: $DB_NAME @ $DB_HOST:$DB_PORT"

    # Set password for psql
    export PGPASSWORD="$DB_PASS"

    # Restore from backup
    if gunzip -c "$BACKUP_FILE" | psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --quiet \
        --single-transaction; then

        unset PGPASSWORD
        log_info "Restore completed successfully!"
        return 0
    else
        unset PGPASSWORD
        log_error "Restore failed!"
        return 1
    fi
}

# Main execution
main() {
    log_info "=========================================="
    log_info "ScheduleOS Database Restore"
    log_info "=========================================="

    parse_db_url "$DATABASE_URL"
    confirm_restore

    if perform_restore; then
        log_info "=========================================="
        log_info "Restore process completed successfully!"
        log_info "=========================================="
        exit 0
    else
        log_error "=========================================="
        log_error "Restore process failed!"
        log_error "=========================================="
        exit 1
    fi
}

main
