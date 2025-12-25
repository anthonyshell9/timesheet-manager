# Key Vault for secrets management
resource "azurerm_key_vault" "main" {
  name                        = "kv-timesheet-${local.suffix}"
  location                    = azurerm_resource_group.main.location
  resource_group_name         = azurerm_resource_group.main.name
  tenant_id                   = data.azurerm_client_config.current.tenant_id
  sku_name                    = "standard"
  enabled_for_disk_encryption = true
  purge_protection_enabled    = true
  soft_delete_retention_days  = 90

  network_acls {
    default_action = "Deny"
    bypass         = "AzureServices"
    ip_rules       = []
    virtual_network_subnet_ids = [
      azurerm_subnet.app_service.id
    ]
  }

  tags = local.common_tags
}

# Access policy for current user/service principal
resource "azurerm_key_vault_access_policy" "terraform" {
  key_vault_id = azurerm_key_vault.main.id
  tenant_id    = data.azurerm_client_config.current.tenant_id
  object_id    = data.azurerm_client_config.current.object_id

  secret_permissions = [
    "Get",
    "List",
    "Set",
    "Delete",
    "Recover",
    "Backup",
    "Restore",
    "Purge"
  ]

  key_permissions = [
    "Get",
    "List",
    "Create",
    "Delete",
    "Update",
    "Recover",
    "Backup",
    "Restore"
  ]
}

# Access policy for App Service
resource "azurerm_key_vault_access_policy" "app_service" {
  key_vault_id = azurerm_key_vault.main.id
  tenant_id    = data.azurerm_client_config.current.tenant_id
  object_id    = azurerm_linux_web_app.main.identity[0].principal_id

  secret_permissions = [
    "Get",
    "List"
  ]
}

# Store secrets in Key Vault
resource "azurerm_key_vault_secret" "db_connection_string" {
  name         = "DatabaseConnectionString"
  value        = "postgresql://${var.postgresql_admin_username}:${random_password.db_password.result}@${azurerm_postgresql_flexible_server.main.fqdn}:5432/timesheet?sslmode=require"
  key_vault_id = azurerm_key_vault.main.id

  depends_on = [azurerm_key_vault_access_policy.terraform]
}

resource "azurerm_key_vault_secret" "nextauth_secret" {
  name         = "NextAuthSecret"
  value        = random_password.nextauth_secret.result
  key_vault_id = azurerm_key_vault.main.id

  depends_on = [azurerm_key_vault_access_policy.terraform]
}

resource "azurerm_key_vault_secret" "azure_ad_client_id" {
  name         = "AzureAdClientId"
  value        = var.azure_ad_client_id
  key_vault_id = azurerm_key_vault.main.id

  depends_on = [azurerm_key_vault_access_policy.terraform]
}

resource "azurerm_key_vault_secret" "azure_ad_client_secret" {
  name         = "AzureAdClientSecret"
  value        = var.azure_ad_client_secret
  key_vault_id = azurerm_key_vault.main.id

  depends_on = [azurerm_key_vault_access_policy.terraform]
}

resource "azurerm_key_vault_secret" "sendgrid_api_key" {
  count        = var.sendgrid_api_key != "" ? 1 : 0
  name         = "SendGridApiKey"
  value        = var.sendgrid_api_key
  key_vault_id = azurerm_key_vault.main.id

  depends_on = [azurerm_key_vault_access_policy.terraform]
}

# Random passwords
resource "random_password" "db_password" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "random_password" "nextauth_secret" {
  length  = 64
  special = true
}
