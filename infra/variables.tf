variable "resource_group_name" {
  description = "Name of the resource group"
  type        = string
  default     = "rg-timesheet-prod"
}

variable "location" {
  description = "Azure region for resources"
  type        = string
  default     = "westeurope"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "prod"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "app_service_sku" {
  description = "App Service SKU"
  type = object({
    tier = string
    size = string
  })
  default = {
    tier = "Standard"
    size = "S1"
  }
}

variable "postgresql_sku" {
  description = "PostgreSQL Flexible Server SKU"
  type        = string
  default     = "B_Standard_B1ms"
}

variable "postgresql_storage_mb" {
  description = "PostgreSQL storage in MB"
  type        = number
  default     = 32768
}

variable "postgresql_version" {
  description = "PostgreSQL version"
  type        = string
  default     = "16"
}

variable "postgresql_admin_username" {
  description = "PostgreSQL admin username"
  type        = string
  default     = "timesheetadmin"
  sensitive   = true
}

variable "azure_ad_tenant_id" {
  description = "Azure AD Tenant ID"
  type        = string
  sensitive   = true
}

variable "azure_ad_client_id" {
  description = "Azure AD Client ID for authentication"
  type        = string
  sensitive   = true
}

variable "azure_ad_client_secret" {
  description = "Azure AD Client Secret for authentication"
  type        = string
  sensitive   = true
}

variable "sendgrid_api_key" {
  description = "SendGrid API Key for email notifications"
  type        = string
  sensitive   = true
  default     = ""
}

variable "alert_email" {
  description = "Email address for alerts"
  type        = string
  default     = ""
}

variable "log_retention_days" {
  description = "Number of days to retain logs (compliance: 5 years = 1825 days)"
  type        = number
  default     = 1825
}

variable "backup_retention_days" {
  description = "Number of days to retain database backups"
  type        = number
  default     = 35
}

variable "enable_geo_redundant_backup" {
  description = "Enable geo-redundant backup for PostgreSQL"
  type        = bool
  default     = true
}
