#!/usr/bin/env python3
import http.client
import json
import sys
import random
import argparse
from datetime import datetime, timedelta

# Sample data
FIRST_NAMES = ["John", "Jane", "Michael", "Emily", "David", "Sarah", "James", "Emma", 
               "Robert", "Olivia", "William", "Sophia", "Richard", "Ava", "Joseph", 
               "Isabella", "Thomas", "Mia", "Charles", "Charlotte"]

LAST_NAMES = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", 
              "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", 
              "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin"]

TASK_NAMES = ["Complete project report", "Review code changes", "Update documentation",
              "Fix critical bug", "Implement new feature", "Attend team meeting",
              "Write unit tests", "Deploy to production", "Database optimization",
              "Security audit", "Performance testing", "Code review session",
              "Client presentation", "Design mockups", "API integration",
              "System maintenance", "Backup database", "Update dependencies",
              "Refactor legacy code", "Create user guide"]

TASK_DESCRIPTIONS = ["High priority task", "Needs immediate attention", 
                     "Scheduled for next sprint", "Waiting for approval",
                     "In progress", "Low priority", "Nice to have",
                     "Customer requested", "Technical debt", "Optional enhancement"]

def create_user(conn, num):
    """Create a random user"""
    first = random.choice(FIRST_NAMES)
    last = random.choice(LAST_NAMES)
    name = f"{first} {last}"
    email = f"{first.lower()}.{last.lower()}{num}@example.com"
    
    user_data = {
        "name": name,
        "email": email
    }
    
    headers = {"Content-Type": "application/json"}
    conn.request("POST", "/api/users", json.dumps(user_data), headers)
    response = conn.getresponse()
    data = response.read().decode()
    
    if response.status in [200, 201]:
        result = json.loads(data)
        return result.get("data", {}).get("_id")
    else:
        print(f"Error creating user: {response.status} - {data}")
        return None

def create_task(conn, user_ids):
    """Create a random task"""
    task_data = {
        "name": random.choice(TASK_NAMES),
        "description": random.choice(TASK_DESCRIPTIONS),
        "deadline": (datetime.now() + timedelta(days=random.randint(1, 60))).isoformat() + "Z",
        "completed": random.random() < 0.5  # 50% chance of being completed
    }
    
    # 60% chance of being assigned to a user
    if user_ids and random.random() < 0.6:
        user_id = random.choice(user_ids)
        task_data["assignedUser"] = user_id
        # Get user name - simplified, just use a placeholder
        task_data["assignedUserName"] = "Assigned User"
    
    headers = {"Content-Type": "application/json"}
    conn.request("POST", "/api/tasks", json.dumps(task_data), headers)
    response = conn.getresponse()
    data = response.read().decode()
    
    if response.status in [200, 201]:
        print(".", end="", flush=True)
        return True
    else:
        print(f"\nError creating task: {response.status} - {data}")
        return False

def main(args):
    parser = argparse.ArgumentParser(description='Populate database with users and tasks')
    parser.add_argument('-u', '--url', default='localhost', help='API URL (default: localhost)')
    parser.add_argument('-p', '--port', type=int, default=3000, help='API port (default: 3000)')
    parser.add_argument('-n', '--users', type=int, default=20, help='Number of users (default: 20)')
    parser.add_argument('-t', '--tasks', type=int, default=100, help='Number of tasks (default: 100)')
    
    parsed_args = parser.parse_args(args)
    
    print(f"Connecting to {parsed_args.url}:{parsed_args.port}")
    print(f"Creating {parsed_args.users} users and {parsed_args.tasks} tasks...\n")
    
    try:
        # Create connection
        conn = http.client.HTTPConnection(parsed_args.url, parsed_args.port, timeout=30)
        
        # Test connection
        conn.request("GET", "/api/")
        response = conn.getresponse()
        response.read()
        
        if response.status != 200:
            print(f"Error: Cannot connect to API at {parsed_args.url}:{parsed_args.port}")
            return
        
        print("✓ Connected to API successfully\n")
        
        # Create users
        print(f"Creating {parsed_args.users} users...")
        user_ids = []
        for i in range(parsed_args.users):
            user_id = create_user(conn, i)
            if user_id:
                user_ids.append(user_id)
            print(".", end="", flush=True)
        
        print(f"\n✓ Created {len(user_ids)} users\n")
        
        # Create tasks
        print(f"Creating {parsed_args.tasks} tasks...")
        task_count = 0
        for i in range(parsed_args.tasks):
            if create_task(conn, user_ids):
                task_count += 1
        
        print(f"\n✓ Created {task_count} tasks\n")
        
        print("=" * 50)
        print("Database population complete!")
        print(f"Total users: {len(user_ids)}")
        print(f"Total tasks: {task_count}")
        print("=" * 50)
        
        conn.close()
        
    except Exception as e:
        print(f"\nError: {str(e)}")
        print("\nMake sure your server is running with 'npm start'")
        sys.exit(1)

if __name__ == "__main__":
    main(sys.argv[1:])
