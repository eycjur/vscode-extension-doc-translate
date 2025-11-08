"""
This is a sample Python file for testing the doc-translate extension.
This docstring should be translated to Japanese when you hover over it.
"""


def add_numbers(a, b):
    """
    Add two numbers and return the result.

    Args:
        a: The first number
        b: The second number

    Returns:
        The sum of a and b
    """
    return a + b


# This is a comment block
# It should also be translated
# when you hover over it
def multiply(x, y):
    return x * y  # This inline comment should be translated too


class Calculator:
    '''
    A simple calculator class that performs basic arithmetic operations.
    This uses single quotes for the docstring.
    '''

    def __init__(self):
        # Initialize the calculator
        # This is another comment block
        self.result = 0

    def calculate(self, operation, a, b):
        """Perform the specified operation on two numbers"""
        if operation == 'add':
            return a + b
        elif operation == 'subtract':
            return a - b
