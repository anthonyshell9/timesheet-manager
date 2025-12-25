# App Service Plan
resource "azurerm_service_plan" "main" {
  name                = "asp-timesheet-${local.suffix}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  os_type             = "Linux"
  sku_name            = "${var.app_service_sku.tier == "Standard" ? "S" : "P"}1"

  tags = local.common_tags
}

# Linux Web App
resource "azurerm_linux_web_app" "main" {
  name                      = "app-timesheet-${local.suffix}"
  location                  = azurerm_resource_group.main.location
  resource_group_name       = azurerm_resource_group.main.name
  service_plan_id           = azurerm_service_plan.main.id
  https_only                = true
  virtual_network_subnet_id = azurerm_subnet.app_service.id

  identity {
    type = "SystemAssigned"
  }

  site_config {
    always_on                         = true
    http2_enabled                     = true
    minimum_tls_version               = "1.2"
    ftps_state                        = "Disabled"
    health_check_path                 = "/api/health"
    health_check_eviction_time_in_min = 5

    application_stack {
      node_version = "20-lts"
    }

    cors {
      allowed_origins     = ["https://app-timesheet-${local.suffix}.azurewebsites.net"]
      support_credentials = true
    }

    ip_restriction {
      action      = "Allow"
      name        = "AllowAll"
      priority    = 100
      ip_address  = "0.0.0.0/0"
    }
  }

  app_settings = {
    "WEBSITE_NODE_DEFAULT_VERSION"            = "~20"
    "WEBSITES_ENABLE_APP_SERVICE_STORAGE"     = "false"
    "SCM_DO_BUILD_DURING_DEPLOYMENT"          = "true"
    "ENABLE_ORYX_BUILD"                       = "true"
    "APP_ENV"                                 = var.environment
    "NEXTAUTH_URL"                            = "https://app-timesheet-${local.suffix}.azurewebsites.net"
    "AZURE_KEY_VAULT_URL"                     = azurerm_key_vault.main.vault_uri
    "AZURE_AD_TENANT_ID"                      = var.azure_ad_tenant_id
    "APPLICATIONINSIGHTS_CONNECTION_STRING"   = azurerm_application_insights.main.connection_string
    "ApplicationInsightsAgent_EXTENSION_VERSION" = "~3"
  }

  sticky_settings {
    app_setting_names = [
      "APPLICATIONINSIGHTS_CONNECTION_STRING",
      "ApplicationInsightsAgent_EXTENSION_VERSION"
    ]
  }

  logs {
    http_logs {
      file_system {
        retention_in_days = 7
        retention_in_mb   = 100
      }
    }

    application_logs {
      file_system_level = "Information"
    }
  }

  tags = local.common_tags
}

# Deployment Slot for staging
resource "azurerm_linux_web_app_slot" "staging" {
  name                      = "staging"
  app_service_id            = azurerm_linux_web_app.main.id
  https_only                = true
  virtual_network_subnet_id = azurerm_subnet.app_service.id

  identity {
    type = "SystemAssigned"
  }

  site_config {
    always_on                         = true
    http2_enabled                     = true
    minimum_tls_version               = "1.2"
    ftps_state                        = "Disabled"
    health_check_path                 = "/api/health"

    application_stack {
      node_version = "20-lts"
    }
  }

  app_settings = {
    "WEBSITE_NODE_DEFAULT_VERSION"            = "~20"
    "WEBSITES_ENABLE_APP_SERVICE_STORAGE"     = "false"
    "SCM_DO_BUILD_DURING_DEPLOYMENT"          = "true"
    "ENABLE_ORYX_BUILD"                       = "true"
    "APP_ENV"                                 = "staging"
    "NEXTAUTH_URL"                            = "https://app-timesheet-${local.suffix}-staging.azurewebsites.net"
    "AZURE_KEY_VAULT_URL"                     = azurerm_key_vault.main.vault_uri
    "AZURE_AD_TENANT_ID"                      = var.azure_ad_tenant_id
    "APPLICATIONINSIGHTS_CONNECTION_STRING"   = azurerm_application_insights.main.connection_string
  }

  tags = local.common_tags
}

# Key Vault access policy for staging slot
resource "azurerm_key_vault_access_policy" "staging_slot" {
  key_vault_id = azurerm_key_vault.main.id
  tenant_id    = data.azurerm_client_config.current.tenant_id
  object_id    = azurerm_linux_web_app_slot.staging.identity[0].principal_id

  secret_permissions = [
    "Get",
    "List"
  ]
}

# Custom domain (optional, configure after initial deployment)
# resource "azurerm_app_service_custom_hostname_binding" "main" {
#   hostname            = "timesheet.yourdomain.com"
#   app_service_name    = azurerm_linux_web_app.main.name
#   resource_group_name = azurerm_resource_group.main.name
# }
