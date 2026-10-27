# Noticia — Problem Statement, Effects, and Solution Approach

## 1. Project Overview

**Project Name:** Noticia - AI Driven Security Information and Event Management System With Real Time Threat Detection and Natural Query Interface

**Domain:** Cybersecurity + Applied AI (Machine Learning + Large Language Models)

**One-line description:** A unified web-based security monitoring platform that ingests security logs, uses machine learning to detect anomalies in real time, and allows security analysts to investigate threats using plain English queries instead of specialized query languages — with all AI answers strictly grounded in real retrieved data to prevent hallucination.

---

## 2. Problem Statement

Modern organizations generate massive volumes of security-relevant logs every day — login attempts, server access records, network traffic, firewall events, and API access logs. Security analysts are responsible for manually reviewing this data to identify potential threats such as brute-force login attempts, credential stuffing, privilege escalation, and unauthorized access.

This manual, human-driven review process has several core weaknesses:

1. **Volume vs. Human Capacity Mismatch:** A mid-sized organization can generate tens of thousands of log events per day. No human team can manually review this volume in real time.

2. **Static, Rule-Based Detection:** Most low-cost or self-managed logging setups rely on fixed rules ("if 5 failed logins in 1 minute, flag it"). These rules cannot adapt to new or evolving attack patterns and generate a high number of false positives.

3. **Expensive, Complex Commercial Tools:** Enterprise-grade SIEM platforms (Splunk, IBM QRadar, Microsoft Sentinel) are effective but come with high licensing costs and require analysts to learn specialized query languages (SPL, KQL) — creating both a financial barrier for smaller organizations and a steep learning curve for junior staff.

4. **Alert Fatigue:** Security teams frequently receive thousands of low-quality alerts per day, the majority of which are false positives. This causes analysts to become desensitized, increasing the risk that a genuine threat is missed.

5. **Slow Investigation Workflow:** When an analyst wants to investigate a specific incident, they must manually write structured database or SIEM queries — a task that is slow even for experienced analysts and nearly inaccessible to newer team members.

**Core problem statement (single paragraph):**
> There is a need for an affordable, AI-augmented security monitoring system that can automatically detect anomalous behavior from log data using machine learning, and allow security personnel to investigate threats using plain, natural language — without requiring specialized query syntax knowledge — while ensuring that AI-generated responses remain strictly grounded in actual retrieved data to avoid misleading or hallucinated conclusions.

---

## 3. Effects of the Problem (What Happens If This Is Not Solved)

| # | Effect | Real-World Consequence |
|---|--------|------------------------|
| 1 | **Delayed threat detection** | Attacks are discovered hours or days after they occur, giving attackers time to cause damage, exfiltrate data, or move laterally within a network. |
| 2 | **Alert fatigue** | Analysts become desensitized to high alert volumes; critical alerts get buried among false positives and are missed. |
| 3 | **Financial loss** | Data breaches carry significant average remediation costs, regulatory fines, and business disruption — potentially fatal for small/mid-size organizations. |
| 4 | **Compliance and legal risk** | Regulated industries (finance, healthcare) face penalties under frameworks like GDPR/HIPAA for delayed breach detection and reporting. |
| 5 | **Skill-gap bottleneck** | Junior analysts cannot investigate incidents independently because they lack query-language expertise, creating dependency on senior staff and slowing response times. |
| 6 | **Reputational damage** | Customers and partners lose trust in an organization following a publicized security incident. |
| 7 | **Operational inefficiency** | Analyst time is consumed by repetitive manual log review instead of higher-value threat-hunting and strategic security work. |

---

## 4. Proposed Solution — How Noticia Solves This

Noticia addresses each of the above problems through four integrated modules:

### 4.1 Centralized Log Ingestion
All security-relevant events (login attempts, access logs, simulated network activity) are collected into a single, normalized data store, removing the "siloed information" problem and giving analysts one place to look.

### 4.2 Machine Learning-Based Anomaly Detection
Instead of static, hand-written rules, a trained classification model (Random Forest / similar) continuously scores incoming events for suspicious behavior, based on patterns learned from established intrusion detection datasets (NSL-KDD / CICIDS2017). This adapts better to varied attack patterns than fixed rule sets and reduces false positives over time.

### 4.3 Real-Time Alerting Dashboard
Flagged events are surfaced immediately on a live dashboard with a severity score, so analysts see the highest-priority threats first instead of scrolling through raw logs — directly addressing alert fatigue.

### 4.4 Natural Language Query Interface (Grounded, Not Hallucinated)
Analysts can ask questions in plain English (e.g., *"Show me all failed logins from IP X today"*). The system:
1. Uses an LLM only to translate the question into a structured, validated database query — never to invent an answer directly.
2. Executes that query against the real database.
3. Feeds the **actual retrieved results** back to the LLM and asks it to summarize *only* what was retrieved (Retrieval-Augmented Generation / RAG pattern).

This directly removes the query-language learning curve for junior analysts while ensuring the AI cannot fabricate results — a critical safety requirement for any security tool.

### 4.5 Role-Based Access Control (RBAC)
Authentication (JWT + hashed passwords) and role separation (Admin / Analyst / Viewer) ensure only authorized personnel can view sensitive data or approve high-impact actions (like blocking an IP), keeping a human in the loop for consequential decisions.

---

## 5. Why This Solution Is Better Than the Status Quo

| Existing Approach | Noticia Approach |
|---|---|
| Manual log review | ML-based automatic anomaly scoring |
| Fixed, rigid detection rules | Adaptive, trained classification model |
| Requires query language (SPL/KQL) | Plain English natural language queries |
| Expensive commercial licensing | Built on free-tier cloud services, low operating cost |
| High false-positive alert volume | Severity-scored, prioritized alerting |
| AI answers cannot be trusted blindly (typical chatbot risk) | RAG-grounded answers, sourced strictly from real data, with human approval required for actions |

---

## 6. Target Users

- Security Operations Center (SOC) analysts, especially junior analysts who lack query-language expertise
- Small-to-mid-size organizations that cannot afford enterprise SIEM licensing
- Educational/demonstration use for security training environments
