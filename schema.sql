-- Meridian Trust Bank Database Schema
-- Run these queries in your Supabase SQL Editor if you wish to initialize manually,
-- although the Node server will automatically provision these tables on startup.

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(30) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  phone VARCHAR(50),
  address VARCHAR(200),
  state VARCHAR(50),
  zip VARCHAR(30),
  ssn VARCHAR(50),
  password VARCHAR(100) NOT NULL,
  account_type VARCHAR(30) NOT NULL,
  kyc_status VARCHAR(30) NOT NULL,
  must_change_password BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS accounts (
  id VARCHAR(30) PRIMARY KEY,
  user_id VARCHAR(30) REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL,
  currency VARCHAR(10) NOT NULL,
  balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  account_number VARCHAR(30) UNIQUE NOT NULL,
  routing_number VARCHAR(30) NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id VARCHAR(30) PRIMARY KEY,
  account_id VARCHAR(30) REFERENCES accounts(id) ON DELETE CASCADE,
  user_id VARCHAR(30) REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL,
  description VARCHAR(200) NOT NULL,
  amount NUMERIC(15, 2) NOT NULL,
  currency VARCHAR(10) NOT NULL,
  date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(30) NOT NULL,
  counterparty VARCHAR(100) NOT NULL,
  swift_details JSONB
);

CREATE TABLE IF NOT EXISTS cards (
  id VARCHAR(30) PRIMARY KEY,
  user_id VARCHAR(30) REFERENCES users(id) ON DELETE CASCADE,
  card_number VARCHAR(30) UNIQUE NOT NULL,
  cardholder_name VARCHAR(100) NOT NULL,
  expiry VARCHAR(10) NOT NULL,
  cvv VARCHAR(5) NOT NULL,
  status VARCHAR(30) NOT NULL,
  type VARCHAR(30) NOT NULL
);

CREATE TABLE IF NOT EXISTS applications (
  id VARCHAR(30) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  phone VARCHAR(50),
  address VARCHAR(200),
  state VARCHAR(50),
  zip VARCHAR(30),
  ssn VARCHAR(50),
  account_type VARCHAR(30) NOT NULL,
  status VARCHAR(30) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
