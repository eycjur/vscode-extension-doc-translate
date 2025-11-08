/**
 * Sample JavaScript file to demonstrate Doc Translate extension
 * This file contains various comment styles that will be translated
 */

/**
 * A class for managing user data
 * Provides CRUD operations for user entities
 */
class UserManager {
    /**
     * Creates a new UserManager instance
     * Initializes the internal user storage
     */
    constructor() {
        this.users = new Map(); // Map to store users by ID
    }

    /**
     * Adds a new user to the system
     * @param {Object} user - The user object to add
     * @param {number} user.id - User's unique identifier
     * @param {string} user.name - User's full name
     * @param {string} user.email - User's email address
     * @returns {boolean} True if the user was added successfully
     */
    addUser(user) {
        // Check if user already exists
        if (this.users.has(user.id)) {
            return false; // User already exists
        }

        // Add user to the map
        this.users.set(user.id, {
            ...user,
            createdAt: new Date()
        });
        return true;
    }

    /**
     * Retrieves a user by their ID
     * @param {number} id - The user's unique identifier
     * @returns {Object|undefined} The user object if found, undefined otherwise
     */
    getUser(id) {
        return this.users.get(id); // Return the user or undefined
    }

    /**
     * Updates an existing user's information
     * @param {number} id - The user's ID
     * @param {Object} updates - Object with fields to update
     * @returns {boolean} True if the update was successful
     */
    updateUser(id, updates) {
        const user = this.users.get(id);

        // User not found
        if (!user) {
            return false;
        }

        /*
         * Merge the updates with the existing user data
         * This preserves fields that weren't updated
         */
        const updatedUser = { ...user, ...updates };
        this.users.set(id, updatedUser);

        return true;
    }

    /**
     * Removes a user from the system
     * @param {number} id - The ID of the user to remove
     * @returns {boolean} True if the user was removed
     */
    deleteUser(id) {
        return this.users.delete(id); // Returns true if deleted
    }

    /**
     * Gets all users in the system
     * @returns {Array} An array of all users
     */
    getAllUsers() {
        // Convert map values to array
        return Array.from(this.users.values());
    }

    /**
     * Searches for users by name
     * Uses case-insensitive partial matching
     * @param {string} query - The search query string
     * @returns {Array} An array of matching users
     */
    searchUsersByName(query) {
        const normalizedQuery = query.toLowerCase();
        const results = [];

        // Iterate through all users
        for (const user of this.users.values()) {
            // Check if the name contains the query
            if (user.name.toLowerCase().includes(normalizedQuery)) {
                results.push(user);
            }
        }

        return results;
    }
}

/**
 * Validates an email address format
 * @param {string} email - The email string to validate
 * @returns {boolean} True if the email is valid
 */
function isValidEmail(email) {
    // Simple email regex pattern
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Generates a unique user ID
 * Uses timestamp and random number
 * @returns {number} A unique numeric ID
 */
function generateUserId() {
    // Combine timestamp with random number
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return timestamp + random;
}

// Example usage
const manager = new UserManager();

// Create a new user
const newUser = {
    id: generateUserId(),
    name: "John Doe",
    email: "john@example.com"
};

// Add the user
manager.addUser(newUser);

/*
 * Search for users by name
 * This will return all matching users
 */
const searchResults = manager.searchUsersByName("John");
console.log(`Found ${searchResults.length} users`);
