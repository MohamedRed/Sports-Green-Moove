terraform {
  required_version = ">= 1.5, < 2.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 7.0"
    }
  }
}

provider "google" {
  project = var.project_id
}

variable "project_id" {
  description = "Existing reviewed project; this configuration never creates projects or billing accounts."
  type        = string
  nullable    = false

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{4,28}[a-z0-9]$", var.project_id))
    error_message = "Supply an explicit existing Google Cloud project ID."
  }
}

resource "google_firebaserules_ruleset" "firestore" {
  project         = var.project_id
  deletion_policy = "ABANDON"

  source {
    files {
      name        = "firestore.rules"
      content     = file("${path.module}/../../firestore.rules")
      fingerprint = filebase64sha256("${path.module}/../../firestore.rules")
    }
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "google_firebaserules_release" "firestore" {
  project         = var.project_id
  name            = "cloud.firestore"
  ruleset_name    = google_firebaserules_ruleset.firestore.id
  deletion_policy = "PREVENT"

  lifecycle {
    prevent_destroy = true
  }
}

import {
  to = google_firebaserules_release.firestore
  id = "projects/${var.project_id}/releases/cloud.firestore"
}

output "policy_sha256" {
  value = filesha256("${path.module}/../../firestore.rules")
}

output "ruleset_name" {
  value = google_firebaserules_ruleset.firestore.id
}
