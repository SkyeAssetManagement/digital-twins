# Process for reviewing PRs

### **Goal**
- We are reviewing a PR From a junior developer on our team.
- The goal is to spot any logic flaws, architectural issues, SOLID violations, bad edge cases, potential bugs, etc.
- But at the same time we should focus on the 80-20, and not overthink it.
- The goal is to review this PR quickly yet thoroughly, just like a Principal Engineer with 15 years of experience would.

### **Rules**
- DO NOT BEGIN UNTIL THE USER GIVES YOU THE PULL REQUEST NUMBER.
- Be concise. Use simple and easy-to-understand language. Write in short sentences.
- DO NOT OVERTHINK! Help the user review this PR like a senior developer would - thoroughly yet efficiently.
- Do not overthink this, just get to work.
- Avoid doing these 'todos', just get to work.

### **Quick Check**
RED FLAGS TO WATCH FOR:
- Files growing beyond 300 LOC
- Adding methods to existing classes
- Modifying working code instead of extending
- Fat interfaces/components doing too much

---

### **Stage 01: Understand the PRs**
1. Run `gh pr view` to get the PR details
2. Run `gh pr diff` to get the diff of the PR
3. In your response, explain to the user what the PR is about, in short
- Proceed to Stage 02 right away

### **Stage 02: Pull the PR branch**
- Run `gh pr checkout <PR-NUMBER>` to pull the PR branch
- Proceed to Stage 03 right away

### **Stage 03: Manual in-app testing**
- Tell the user how to manually test the PR
- The user already has frontend & backend running locally
- Assume he should spend 3-5 minutes testing the core changes
- Don't overthink this, just give the 80-20 testing instructions. be concise.
- STOP. wait for user input.

### **Stage 04: File-by-file review**
1. For each file, `head/path/to/file/*filename*`
- Run `gh pr diff <file-path>`
- BE NOT LAZY! Actually read the file. The READY the file, ALL of the lines will be read. READ ALL LINES (ctrl+r to expand)
- The user will tell you if the character count shows truncation and prevents typing beyond the limit.
- If not, tell the user to fix it, otherwise, proceed to the next step.
- The user will confirm the fix.
- In plain english explain what was changed by this PR, and why. Make your answer short & conversational.
- use newline to make your answer more readable.
- STRUCTURE YOUR RESPONSE LIKE THIS:
- `stage-04-response-structure`
- file name: `<file-name>`
- next, output a few emojis on a newline
- 1-2 sentences explaining what was changed by this PR, and why.
- then, output 5 characters, follow newline.
- then, output a 🦊 emoji, followed by 1-2 sentences explaining what's good about this change
- then, output a 🔴 emoji, then 1-2 sentences giving an objective conclusion about the changes to this file, pointing out any serious issues (if any), just like a senior developer would.
- if a clear colorful emoji (approve/reject/request-changes)
- BE FUCKING CONCISE! DO NOT WASTE THE USER'S TIME. Use clear, simple, easy-to-understand language. Focus on explaining the changes the PR did to this file. if it's just a few lines, make response short.
- The user will respond. The length of your response should be proportional to the amount of changes in this file. If it's just a few lines, make response short.
- then, output a 🦊 emoji, followed by 1-2 sentences explaining what's good about this change and if it's not good, then use the 🔴 emoji instead.
- The user will respond. The length of your response should be proportional to the amount of changes in this file. If it's just a few lines, make response short.

### **Stage 05: STOP. Wait after each file. User input.**

### **Stage 06: FINALIZING**
1. Analyze your previous responses to confirm that you have provided a thorough review.
2. Provide a summary of your findings to the user, including both positive aspects and areas for improvement.
3. Suggest next steps based on your review, such as merging the PR, requesting further changes, or performing additional tests.

### **Stage 07: SOLID Principles Check**
1. Is the code clean?
2. Are there any hardcoded dependencies?
3. Check if existing dependencies are being modified instead of extended. (DIP violation)
4. Are new dependencies hardcoded instead of injected? (DIP violation)
5. Check if the code has any security vulnerabilities, and if so, how severe are they?
6. Is the code performing any validation on user input? If not, what are the potential consequences?
7. Is the code adequately handling edge cases or error scenarios?
8. Are there any new APIs or external services being called? If so, are they secured properly and handled with appropriate error handling?
9. Is the code following the principle of least privilege, especially when interacting with external systems or sensitive data?
10. Is the code idempotent where necessary, especially for write operations?
11. Is the code using secure communication protocols where sensitive data is transmitted?
12. Is the code generating any new logs or metrics? If so, are they sufficient for monitoring and debugging?