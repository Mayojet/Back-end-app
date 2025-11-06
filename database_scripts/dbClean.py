#!/usr/bin/env python3
import http.client
import json
import sys
import argparse

def delete_all_users(conn):
    """Get all users and delete them"""
    conn.request("GET", "/api/users")
    response = conn.getresponse()
    data = response.read().decode()
    
    if response.status != 200:
        print(f"Error getting users: {response.status}")
        return 0
    
    result = json.loads(data)
    users = result.get("data", [])
    
    deleted = 0
    for user in users:
        user_id = user.get("_id")
        if user_id:
            conn.request("DELETE", f"/api/users/{user_id}")
            response = conn.getresponse()
            response.read()
            if response.status in [200, 204]:
                deleted += 1
                print(".", end="", flush=True)
    
    return deleted

def delete_all_tasks(conn):
    """Get all tasks and delete them"""
    conn.request("GET", "/api/tasks?limit=1000")
    response = conn.getresponse()
    data = response.read().decode()
    
    if response.status != 200:
        print(f"Error getting tasks: {response.status}")
        return 0
    
    result = json.loads(data)
    tasks = result.get("data", [])
    
    deleted = 0
    for task in tasks:
        task_id = task.get("_id")
        if task_id:
            conn.request("DELETE", f"/api/tasks/{task_id}")
            response = conn.getresponse()
            response.read()
            if response.status in [200, 204]:
                deleted += 1
                print(".", end="", flush=True)
    
    return deleted

def main(args):
    parser = argparse.ArgumentParser(description='Clean all data from database')
    parser.add_argument('-u', '--url', default='localhost', help='API URL (default: localhost)')
    parser.add_argument('-p', '--port', type=int, default=3000, help='API port (default: 3000)')
    
    parsed_args = parser.parse_args(args)
    
    print(f"Connecting to {parsed_args.url}:{parsed_args.port}")
    print("WARNING: This will delete ALL users and tasks!\n")
    
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
        
        # Delete all tasks first (to avoid reference issues)
        print("Deleting all tasks...")
        task_count = delete_all_tasks(conn)
        print(f"\n✓ Deleted {task_count} tasks\n")
        
        # Delete all users
        print("Deleting all users...")
        user_count = delete_all_users(conn)
        print(f"\n✓ Deleted {user_count} users\n")
        
        print("=" * 50)
        print("Database cleaned!")
        print(f"Deleted {user_count} users and {task_count} tasks")
        print("=" * 50)
        
        conn.close()
        
    except Exception as e:
        print(f"\nError: {str(e)}")
        print("\nMake sure your server is running with 'npm start'")
        sys.exit(1)

if __name__ == "__main__":
    main(sys.argv[1:])

