"""
Sample Python file to demonstrate Doc Translate extension
This module contains various comment styles that will be translated
"""

from typing import Optional, List, Dict
from datetime import datetime


class User:
    """
    Represents a user in the system
    Contains basic user information
    """

    def __init__(self, user_id: int, name: str, email: str):
        """
        Initialize a new User instance
        
        Args:
            user_id: Unique identifier for the user
            name: Full name of the user
            email: Email address of the user
        """
        self.id = user_id
        self.name = name
        self.email = email
        self.created_at = datetime.now()  # Timestamp when user was created


class UserManager:
    """
    A class for managing user data
    Provides CRUD operations for user entities
    """

    def __init__(self):
        """
        Creates a new UserManager instance
        Initializes the internal user storage
        """
        self.users: Dict[int, User] = {}  # Dictionary to store users by ID

    def add_user(self, user: User) -> bool:
        """
        Adds a new user to the system
        
        Args:
            user: The User object to add
            
        Returns:
            True if the user was added successfully, False otherwise
        """
        # Check if user already exists
        if user.id in self.users:
            return False  # User already exists
        
        # Add user to the dictionary
        self.users[user.id] = user
        return True

    def get_user(self, user_id: int) -> Optional[User]:
        """
        Retrieves a user by their ID
        
        Args:
            user_id: The user's unique identifier
            
        Returns:
            The User object if found, None otherwise
        """
        return self.users.get(user_id)  # Return the user or None

    def update_user(self, user_id: int, name: Optional[str] = None, 
                   email: Optional[str] = None) -> bool:
        """
        Updates an existing user's information
        
        Args:
            user_id: The user's ID
            name: New name for the user (optional)
            email: New email for the user (optional)
            
        Returns:
            True if the update was successful, False otherwise
        """
        user = self.users.get(user_id)
        
        # User not found
        if user is None:
            return False
        
        """
        Update the user fields
        Only update non-None values
        """
        if name is not None:
            user.name = name
        if email is not None:
            user.email = email
        
        return True

    def delete_user(self, user_id: int) -> bool:
        """
        Removes a user from the system
        
        Args:
            user_id: The ID of the user to remove
            
        Returns:
            True if the user was removed, False otherwise
        """
        # Check if user exists before deleting
        if user_id not in self.users:
            return False
        
        # Delete the user
        del self.users[user_id]
        return True

    def get_all_users(self) -> List[User]:
        """
        Gets all users in the system
        
        Returns:
            A list of all User objects
        """
        # Convert dictionary values to list
        return list(self.users.values())

    def search_users_by_name(self, query: str) -> List[User]:
        """
        Searches for users by name
        Uses case-insensitive partial matching
        
        Args:
            query: The search query string
            
        Returns:
            A list of matching User objects
        """
        normalized_query = query.lower()
        results = []
        
        # Iterate through all users
        for user in self.users.values():
            # Check if the name contains the query
            if normalized_query in user.name.lower():
                results.append(user)
        
        return results


def is_valid_email(email: str) -> bool:
    """
    Validates an email address format
    
    Args:
        email: The email string to validate
        
    Returns:
        True if the email is valid, False otherwise
    """
    # Simple email validation
    return '@' in email and '.' in email


def generate_user_id() -> int:
    """
    Generates a unique user ID
    Uses current timestamp
    
    Returns:
        A unique numeric ID
    """
    # Use timestamp as ID
    return int(datetime.now().timestamp() * 1000)


# Example usage
if __name__ == "__main__":
    # Create a new manager
    manager = UserManager()
    
    # Create a new user
    new_user = User(
        user_id=generate_user_id(),
        name="John Doe",
        email="john@example.com"
    )
    
    # Add the user
    if manager.add_user(new_user):
        print("User added successfully")
    
    """
    Search for users by name
    This will return all matching users
    """
    search_results = manager.search_users_by_name("John")
    print(f"Found {len(search_results)} users")
    
    # Display all users
    for user in search_results:
        print(f"User: {user.name} ({user.email})")
