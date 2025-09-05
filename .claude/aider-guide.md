# Safe File Refactoring Guide

## Core Principles
1. **Safety First** - System must remain functional throughout refactoring
2. **Incremental Changes** - 50-150 lines per commit, never big-bang rewrites
3. **Test Coverage Required** - No refactoring without tests
4. **Feature Flags** - Deploy behind flags for safe rollback
5. **Risk-Based Order** - Start with lowest-risk extractions

## Refactoring Process

### Step 1: Create Safety Net
Before ANY refactoring:
```python
# Write characterization tests for current behavior
def test_existing_behavior():
    # Capture current outputs for all public methods
    # Test edge cases and error conditions
    # Document any quirks as "legacy behavior"
```

### Step 2: Analyze the File
Identify refactoring targets by looking for:
- Methods over 20 lines
- Classes over 200 lines  
- Duplicate code blocks
- Mixed abstraction levels
- Data clumps (variables that always appear together)
- Feature envy (methods that use another class more than their own)

### Step 3: Apply Refactoring Patterns

#### Extract Method Pattern
When you see a code block with a comment explaining what it does:
```python
# BEFORE: Long method with commented sections
def process_order(order):
    # Validate order
    if not order.items:
        raise ValueError("Empty order")
    if order.total < 0:
        raise ValueError("Invalid total")
    
    # Calculate tax
    tax_rate = 0.08
    if order.state == "CA":
        tax_rate = 0.0975
    tax = order.subtotal * tax_rate
    
    # Apply discount
    discount = 0
    if order.coupon:
        discount = order.subtotal * order.coupon.rate
    
    return order.subtotal + tax - discount

# AFTER: Extracted methods
def process_order(order):
    validate_order(order)
    tax = calculate_tax(order)
    discount = calculate_discount(order)
    return order.subtotal + tax - discount

def validate_order(order):
    if not order.items:
        raise ValueError("Empty order")
    if order.total < 0:
        raise ValueError("Invalid total")

def calculate_tax(order):
    tax_rate = 0.08 if order.state != "CA" else 0.0975
    return order.subtotal * tax_rate

def calculate_discount(order):
    return order.subtotal * order.coupon.rate if order.coupon else 0
```

#### Extract Class Pattern
When you see related data and methods:
```python
# BEFORE: Mixed responsibilities
class User:
    def __init__(self):
        self.name = ""
        self.email = ""
        # Address fields mixed in
        self.street = ""
        self.city = ""
        self.zip = ""
        
    def validate_email(self):
        return "@" in self.email
    
    def format_address(self):
        return f"{self.street}, {self.city} {self.zip}"

# AFTER: Extracted Address class
class Address:
    def __init__(self, street="", city="", zip=""):
        self.street = street
        self.city = city
        self.zip = zip
    
    def format(self):
        return f"{self.street}, {self.city} {self.zip}"

class User:
    def __init__(self):
        self.name = ""
        self.email = ""
        self.address = Address()
    
    def validate_email(self):
        return "@" in self.email
```

#### Strangler Fig Pattern
For replacing legacy code gradually:
```python
# Step 1: Create new implementation alongside old
class LegacyPaymentProcessor:
    def process(self, amount):
        # Complex legacy logic
        pass

class ModernPaymentProcessor:
    def process(self, amount):
        # Clean new implementation
        pass

# Step 2: Router with feature flag
class PaymentRouter:
    def __init__(self, use_modern=False):
        self.use_modern = use_modern
        self.legacy = LegacyPaymentProcessor()
        self.modern = ModernPaymentProcessor()
    
    def process(self, amount):
        if self.use_modern:
            return self.modern.process(amount)
        return self.legacy.process(amount)

# Step 3: Gradually increase modern usage
# Step 4: Remove legacy when 100% on modern
```

### Step 4: Execution Order (By Risk)

1. **Lowest Risk: Private Helper Methods**
   - Extract private utility functions
   - No external API changes
   - Easy to test in isolation

2. **Low Risk: Data Classes**
   - Extract value objects and data containers
   - Replace primitives with objects
   - Maintain backward compatibility

3. **Medium Risk: Service Extraction**
   - Extract business logic to service classes
   - Keep original class as facade initially
   - Gradually migrate callers

4. **High Risk: Interface Changes**
   - Use adapter pattern first
   - Migrate callers incrementally
   - Remove old interface only when safe

### Step 5: Safety Checklist

Before EVERY commit:
- [ ] All existing tests still pass
- [ ] New tests cover refactored code
- [ ] No public API changes without version planning
- [ ] Feature flag configured if changing behavior
- [ ] Commit message explains the refactoring
- [ ] Diff is under 200 lines

### Common Anti-Patterns to Avoid

1. **Shotgun Surgery** - Making tiny changes across many files
2. **Golden Hammer** - Using same pattern everywhere
3. **Poltergeist Classes** - Classes that only pass through calls
4. **Yo-yo Problem** - Too much inheritance depth

### Measuring Success

Track these metrics:
- File size reduction per sprint
- Test coverage increase
- Cyclomatic complexity decrease
- Team velocity improvement
- Bug rate in refactored areas

### Emergency Rollback Plan

If production issues occur:
1. Immediately disable feature flag
2. Revert commit if flag insufficient
3. Write test for the failure case
4. Fix forward with test in place

## Practical Refactoring Commands

When reviewing a large file:
```bash
# Analyze complexity
aider --message "Identify the top 3 highest complexity methods in this file and suggest extraction targets"

# Plan refactoring
aider --message "Create a risk-ordered refactoring plan for this file, starting with the safest extractions"

# Execute specific refactoring
aider --message "Extract the validation logic from process_order() into a separate validate_order() method with tests"

# Verify safety
aider --message "Review this refactoring for any breaking changes to public APIs or behavior changes"
```

## Example Prompts for Common Scenarios

**For a 1000+ line file:**
"Identify 3-5 cohesive groups of methods and data that could become separate classes. Start with the group that has the least coupling to the rest of the file."

**For a god class:**
"Apply the Single Responsibility Principle. What are the 2-3 main responsibilities this class has? Create a plan to extract each into its own class."

**For duplicate code:**
"Find all duplicate code blocks over 5 lines. Create a single method to replace them, parameterizing the differences."

**For complex conditionals:**
"Replace this nested if-else chain with a strategy pattern or polymorphism. Show the refactoring step-by-step."

## Remember

- Small, safe steps beat big risky leaps
- Tests are your safety net, not optional
- Feature flags enable safe experimentation
- Measure everything to prove value
- The goal is maintainability, not perfection