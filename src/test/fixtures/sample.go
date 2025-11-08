/*
Package sample demonstrates the Doc Translate extension for Go
This package contains various comment styles that will be translated
*/
package sample

import (
	"errors"
	"fmt"
	"strings"
	"time"
)

// User represents a user in the system
type User struct {
	ID        int       // Unique identifier for the user
	Name      string    // Full name of the user
	Email     string    // Email address
	CreatedAt time.Time // Timestamp when the user was created
}

// UserManager manages a collection of users
// It provides CRUD operations for user entities
type UserManager struct {
	users map[int]*User // Internal storage for users
}

// NewUserManager creates a new UserManager instance
// Initializes the internal user storage
func NewUserManager() *UserManager {
	return &UserManager{
		users: make(map[int]*User),
	}
}

// AddUser adds a new user to the system
// Returns an error if the user already exists
func (m *UserManager) AddUser(user *User) error {
	// Check if user already exists
	if _, exists := m.users[user.ID]; exists {
		return errors.New("user already exists")
	}

	// Add user to the map
	m.users[user.ID] = user
	return nil
}

// GetUser retrieves a user by their ID
// Returns the user if found, nil and an error otherwise
func (m *UserManager) GetUser(id int) (*User, error) {
	user, exists := m.users[id]
	if !exists {
		// User not found
		return nil, fmt.Errorf("user with ID %d not found", id)
	}
	return user, nil
}

// UpdateUser updates an existing user's information
// Only updates the fields that are provided
func (m *UserManager) UpdateUser(id int, name, email string) error {
	user, exists := m.users[id]

	// User not found
	if !exists {
		return fmt.Errorf("user with ID %d not found", id)
	}

	/*
	 * Update the user fields
	 * Only update non-empty values
	 */
	if name != "" {
		user.Name = name
	}
	if email != "" {
		user.Email = email
	}

	return nil
}

// DeleteUser removes a user from the system
// Returns an error if the user doesn't exist
func (m *UserManager) DeleteUser(id int) error {
	// Check if user exists
	if _, exists := m.users[id]; !exists {
		return fmt.Errorf("user with ID %d not found", id)
	}

	// Delete the user
	delete(m.users, id)
	return nil
}

// GetAllUsers returns all users in the system
// Returns a slice of all user pointers
func (m *UserManager) GetAllUsers() []*User {
	// Create a slice to hold all users
	users := make([]*User, 0, len(m.users))

	// Add all users to the slice
	for _, user := range m.users {
		users = append(users, user)
	}

	return users
}

// SearchUsersByName searches for users by name
// Uses case-insensitive partial matching
// Returns a slice of matching users
func (m *UserManager) SearchUsersByName(query string) []*User {
	normalizedQuery := strings.ToLower(query)
	results := make([]*User, 0)

	// Iterate through all users
	for _, user := range m.users {
		// Check if the name contains the query
		if strings.Contains(strings.ToLower(user.Name), normalizedQuery) {
			results = append(results, user)
		}
	}

	return results
}

// GetUserCount returns the total number of users
// This is a simple helper method
func (m *UserManager) GetUserCount() int {
	return len(m.users) // Return the map length
}

// IsValidEmail validates an email address format
// Uses a simple validation pattern
func IsValidEmail(email string) bool {
	// Check for basic email structure
	return strings.Contains(email, "@") && strings.Contains(email, ".")
}

// GenerateUserID generates a unique user ID
// Uses current timestamp in nanoseconds
func GenerateUserID() int {
	// Use Unix timestamp as ID
	return int(time.Now().UnixNano())
}

/*
 * Example function demonstrating the usage
 * This would typically be in a separate example file
 */
func ExampleUsage() {
	// Create a new manager
	manager := NewUserManager()

	// Create a new user
	newUser := &User{
		ID:        GenerateUserID(),
		Name:      "John Doe",
		Email:     "john@example.com",
		CreatedAt: time.Now(),
	}

	// Add the user
	if err := manager.AddUser(newUser); err != nil {
		fmt.Printf("Error adding user: %v\n", err)
		return
	}

	/*
	 * Search for users by name
	 * This will return all matching users
	 */
	results := manager.SearchUsersByName("John")
	fmt.Printf("Found %d users\n", len(results))

	// Display all users
	for _, user := range results {
		fmt.Printf("User: %s (%s)\n", user.Name, user.Email)
	}
}

// UserStats contains statistics about users
type UserStats struct {
	TotalUsers  int       // Total number of users
	NewestUser  *User     // Most recently created user
	OldestUser  *User     // First created user
	LastUpdated time.Time // Last time stats were calculated
}

// CalculateStats calculates statistics for all users
// Returns a UserStats struct with aggregated data
func (m *UserManager) CalculateStats() *UserStats {
	stats := &UserStats{
		TotalUsers:  len(m.users),
		LastUpdated: time.Now(),
	}

	// Find newest and oldest users
	for _, user := range m.users {
		// Check for newest user
		if stats.NewestUser == nil || user.CreatedAt.After(stats.NewestUser.CreatedAt) {
			stats.NewestUser = user
		}

		// Check for oldest user
		if stats.OldestUser == nil || user.CreatedAt.Before(stats.OldestUser.CreatedAt) {
			stats.OldestUser = user
		}
	}

	return stats
}
