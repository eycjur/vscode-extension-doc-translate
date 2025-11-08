/**
 * Sample TypeScript file to demonstrate Doc Translate extension
 * This file contains various comment styles that will be translated
 */

/**
 * Represents a user in the system
 */
interface User {
    id: number;
    name: string;
    email: string;
    createdAt: Date;
}

/**
 * A class for managing user data
 * Provides CRUD operations for user entities
 */
class UserManager {
    private users: Map<number, User>;

    /**
     * Creates a new UserManager instance
     * Initializes the internal user storage
     */
    constructor() {
        this.users = new Map();
    }

    /**
     * Adds a new user to the system
     * @param user The user object to add
     * @returns True if the user was added successfully
     */
    addUser(user: User): boolean {
        // Check if user already exists
        if (this.users.has(user.id)) {
            return false; // User already exists
        }

        // Add user to the map
        this.users.set(user.id, user);
        return true;
    }

    /**
     * Retrieves a user by their ID
     * @param id The user's unique identifier
     * @returns The user object if found, undefined otherwise
     */
    getUser(id: number): User | undefined {
        return this.users.get(id); // Return the user or undefined
    }

    /**
     * Updates an existing user's information
     * @param id The user's ID
     * @param updates Partial user object with fields to update
     * @returns True if the update was successful
     */
    updateUser(id: number, updates: Partial<User>): boolean {
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
     * @param id The ID of the user to remove
     * @returns True if the user was removed
     */
    deleteUser(id: number): boolean {
        return this.users.delete(id); // Returns true if deleted
    }

    /**
     * Gets all users in the system
     * @returns An array of all users
     */
    getAllUsers(): User[] {
        // Convert map values to array
        return Array.from(this.users.values());
    }

    /**
     * Searches for users by name
     * Uses case-insensitive partial matching
     * @param query The search query string
     * @returns An array of matching users
     */
    searchUsersByName(query: string): User[] {
        const normalizedQuery = query.toLowerCase();
        const results: User[] = [];

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
 * @param email The email string to validate
 * @returns True if the email is valid
 */
function isValidEmail(email: string): boolean {
    // Simple email regex pattern
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Generates a unique user ID
 * Uses timestamp and random number
 * @returns A unique numeric ID
 */
function generateUserId(): number {
    // Combine timestamp with random number
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return timestamp + random;
}

// Example usage
const manager = new UserManager();

// Create a new user
const newUser: User = {
    id: generateUserId(),
    name: "John Doe",
    email: "john@example.com",
    createdAt: new Date()
};

// Add the user
manager.addUser(newUser);

/*
 * You can also search for users
 * This will return all matching users
 */
const searchResults = manager.searchUsersByName("John");
console.log(searchResults);
