export const DEFAULT_TOOL = {
  name: 'financial_calculator',
  description: 'Performs financial calculations including compound interest, loans, and investments',
  code: `def financial_calculator(**kwargs):
    operation = kwargs.get('operation', 'compound_interest')
    principal = kwargs.get('principal', 0)
    rate = kwargs.get('rate', 0)
    time = kwargs.get('time', 0)
    periods = kwargs.get('periods', 1)
    payment = kwargs.get('payment', 0)
    future_value = kwargs.get('future_value', 0)
    
    try:
        if operation == 'compound_interest':
            return principal * (1 + rate / periods) ** (periods * time)
        
        elif operation == 'simple_interest':
            return principal * (1 + rate * time)
        
        elif operation == 'present_value':
            return future_value / (1 + rate) ** time
        
        elif operation == 'future_value_annuity':
            if rate == 0:
                return payment * periods
            return payment * (((1 + rate) ** periods - 1) / rate)
        
        elif operation == 'loan_payment':
            r = rate / 12
            n = time * 12
            if r == 0:
                return principal / n
            return principal * (r * (1 + r) ** n) / ((1 + r) ** n - 1)
        
        elif operation == 'effective_rate':
            return (1 + rate / periods) ** periods - 1
        
        elif operation == 'rule_of_72':
            if rate == 0:
                return "Error: Rate cannot be zero"
            return 72 / (rate * 100)
        
        elif operation == 'remaining_balance':
            payments_made = kwargs.get('payments_made', 0)
            r = rate / 12
            n = time * 12
            if r == 0:
                return principal - (principal / n * payments_made)
            payment = principal * (r * (1 + r) ** n) / ((1 + r) ** n - 1)
            return principal * (1 + r) ** payments_made - payment * (((1 + r) ** payments_made - 1) / r)
        
        else:
            return f"Error: Unknown operation '{operation}'"
            
    except Exception as e:
        return f"Error: {str(e)}"`,
  schema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        description: 'Financial calculation to perform',
        enum: [
          'compound_interest',
          'simple_interest',
          'present_value',
          'future_value_annuity',
          'loan_payment',
          'effective_rate',
          'rule_of_72',
          'remaining_balance'
        ]
      },
      principal: {
        type: 'number',
        description: 'Initial amount or loan amount'
      },
      rate: {
        type: 'number',
        description: 'Interest rate as decimal (e.g., 0.05 for 5%)'
      },
      time: {
        type: 'number',
        description: 'Time period in years'
      },
      periods: {
        type: 'number',
        description: 'Compounding periods per year (default: 1)',
        default: 1
      },
      payment: {
        type: 'number',
        description: 'Regular payment amount for annuities'
      },
      future_value: {
        type: 'number',
        description: 'Future value for present value calculations'
      },
      payments_made: {
        type: 'number',
        description: 'Number of payments made (for remaining balance)'
      }
    },
    required: ['operation']
  }
};