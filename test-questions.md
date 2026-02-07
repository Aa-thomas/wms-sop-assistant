# WMS SOP Assistant - Test Questions

## Instructions for Testing
1. Ask each question through the UI
2. Check: Does the answer make sense?
3. Check: Do citations reference correct slides?
4. Note: What could be better?

---

## Navigation Module

### Question 1: Basic Navigation
**Q:** "How do I navigate to the Picking screen?"  
**Expected:** Should cite Navigation SOP, explain menu path  
**Expected Module:** Navigation

### Question 2: Login
**Q:** "What are the steps to log into the WMS?"  
**Expected:** Should cite Navigation SOP with login procedure  
**Expected Module:** Navigation

---

## Inbound Module

### Question 3: Basic Inbound
**Q:** "How do I receive an inbound order?"  
**Expected:** Should cite Inbound Order Process SOP with step-by-step  
**Expected Module:** Inbound

### Question 4: Quantity Mismatch
**Q:** "What do I do if the quantity doesn't match the PO?"  
**Expected:** Should cite Inbound SOP with discrepancy handling  
**Expected Module:** Inbound

### Question 5: Damaged Goods
**Q:** "How do I handle damaged items during receiving?"  
**Expected:** Should cite Inbound SOP or Returns SOP  
**Expected Module:** Inbound or Returns

---

## Outbound Module

### Question 6: Short Pick Handling
**Q:** "How do I process a short pick?"  
**Expected:** Should cite Outbound Order Process SOP with short pick procedure  
**Expected Module:** Outbound

### Question 7: Order Allocation
**Q:** "What screen do I use for order allocation?"  
**Expected:** Should cite Outbound SOP with screen name and navigation  
**Expected Module:** Outbound

### Question 8: Packing Process
**Q:** "What are the steps to pack an outbound order?"  
**Expected:** Should cite Outbound SOP with packing procedure  
**Expected Module:** Outbound

---

## Picking Module

### Question 9: RF Gun Usage
**Q:** "How do I use the RF gun for picking?"  
**Expected:** Should cite Picking SOP with RF gun instructions  
**Expected Module:** Picking

### Question 10: Batch Picking
**Q:** "What is the process for batch picking?"  
**Expected:** Should cite Picking SOP with batch picking steps  
**Expected Module:** Picking

---

## Inventory Module

### Question 11: Inventory Move
**Q:** "How do I move inventory from one location to another?"  
**Expected:** Should cite Inventory Store-Move-Relocation SOP  
**Expected Module:** Inventory

### Question 12: Inventory Adjustment
**Q:** "How do I adjust inventory quantities?"  
**Expected:** Should cite Inventory Adjustments SOP  
**Expected Module:** Inventory

---

## Cycle Counts Module

### Question 13: Cycle Count Execution
**Q:** "What are the steps to perform a cycle count?"  
**Expected:** Should cite Cycle Counts SOP with procedure  
**Expected Module:** CycleCounts

### Question 14: Cycle Count Discrepancies
**Q:** "What do I do if I find a discrepancy during a cycle count?"  
**Expected:** Should cite Cycle Counts SOP with discrepancy handling  
**Expected Module:** CycleCounts

---

## Returns Module

### Question 15: Customer Return Processing
**Q:** "How do I process a customer return?"  
**Expected:** Should cite Customer Returns SOP with return procedure  
**Expected Module:** Returns

---

## Edge Cases (Safe Failure Tests)

### Question 16: Ambiguous Question
**Q:** "How do I process an order?"  
**Expected:** Should ask clarifying question: "Are you asking about inbound or outbound orders?"  
**Expected Behavior:** Safe failure with follow-up

### Question 17: Out of Scope
**Q:** "What's the weather today?"  
**Expected:** "Not found in SOPs. Are you looking for information about warehouse procedures or WMS system operations?"  
**Expected Behavior:** Safe failure

### Question 18: Out of Scope (Different Domain)
**Q:** "How do I file my taxes?"  
**Expected:** "Not found in SOPs."  
**Expected Behavior:** Safe failure

### Question 19: Partial Match
**Q:** "How do I handle a mismatch?"  
**Expected:** Should ask: "Are you asking about quantity mismatches during receiving, inventory discrepancies, or cycle count mismatches?"  
**Expected Behavior:** Clarifying question

### Question 20: Multi-Module Topic
**Q:** "What do I do with damaged inventory?"  
**Expected:** Should cite both Returns SOP and Inventory Adjustments SOP  
**Expected Behavior:** Multiple citations from different modules

---

## Testing Checklist

After building the MVP, manually test:

- [ ] All 15 core questions return relevant answers
- [ ] All answers include citations (doc_title + slide number)
- [ ] Edge cases trigger "Not found in SOPs" + clarifying question
- [ ] Module filter works (test Question 6 with Outbound filter)
- [ ] Citations reference actual slides in SOPs (spot check 5 random citations)
- [ ] Response time <3 seconds
- [ ] UI works on mobile width
- [ ] Feedback buttons store data in Postgres

---

## Notes During Testing

*(Add observations here as you test)*

**Question 6 (Short Pick):**
- Answer: [paste answer]
- Citations: [paste citations]
- Issues: [any problems?]

**Question 17 (Out of Scope):**
- Response: [paste response]
- Correct safe failure? [yes/no]

---

## v2 Improvements (Based on Testing)

*(Fill this in after testing)*

**Top 3 issues:**
1. 
2. 
3. 

**Features to add:**
- [ ] 
- [ ] 
- [ ] 
