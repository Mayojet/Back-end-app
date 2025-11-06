var Task = require('../models/task');
var User = require('../models/user');

module.exports = function (router) {

    // GET /api/tasks - Get all tasks with query parameters
    router.get('/tasks', function (req, res) {
        try {
            // Parse query parameters
            var where = req.query.where ? JSON.parse(req.query.where) : {};
            var sort = req.query.sort ? JSON.parse(req.query.sort) : {};
            var select = req.query.select ? JSON.parse(req.query.select) : {};
            var skip = req.query.skip ? parseInt(req.query.skip) : 0;
            var limit = req.query.limit ? parseInt(req.query.limit) : 100; // Default 100 for tasks
            var count = req.query.count === 'true';

            // If count is requested, return count
            if (count) {
                Task.countDocuments(where, function (err, count) {
                    if (err) {
                        return res.status(500).json({
                            message: "Error counting tasks",
                            data: {}
                        });
                    }
                    res.status(200).json({
                        message: "OK",
                        data: count
                    });
                });
            } else {
                // Build query
                var query = Task.find(where).sort(sort).select(select).skip(skip).limit(limit);

                query.exec(function (err, tasks) {
                    if (err) {
                        return res.status(500).json({
                            message: "Error retrieving tasks",
                            data: {}
                        });
                    }
                    res.status(200).json({
                        message: "OK",
                        data: tasks
                    });
                });
            }
        } catch (err) {
            return res.status(400).json({
                message: "Bad request. Invalid query parameters",
                data: {}
            });
        }
    });

    // POST /api/tasks - Create a new task
    router.post('/tasks', function (req, res) {
        // Validate required fields
        if (!req.body.name || !req.body.deadline) {
            return res.status(400).json({
                message: "Name and deadline are required",
                data: {}
            });
        }

        var task = new Task({
            name: req.body.name,
            description: req.body.description || "",
            deadline: req.body.deadline,
            completed: req.body.completed || false,
            assignedUser: req.body.assignedUser || "",
            assignedUserName: req.body.assignedUserName || "unassigned"
        });

        task.save(function (err, savedTask) {
            if (err) {
                return res.status(500).json({
                    message: "Error creating task",
                    data: {}
                });
            }

            // If task is assigned to a user, add it to user's pendingTasks
            if (savedTask.assignedUser && savedTask.assignedUser !== "" && !savedTask.completed) {
                User.findById(savedTask.assignedUser, function (err, user) {
                    if (!err && user) {
                        if (user.pendingTasks.indexOf(savedTask._id.toString()) === -1) {
                            user.pendingTasks.push(savedTask._id.toString());
                            user.save(function (err) {
                                if (err) {
                                    console.log("Error updating user's pendingTasks:", err);
                                }
                            });
                        }
                    }
                });
            }

            res.status(201).json({
                message: "Task created successfully",
                data: savedTask
            });
        });
    });

    // GET /api/tasks/:id - Get a specific task
    router.get('/tasks/:id', function (req, res) {
        try {
            var select = req.query.select ? JSON.parse(req.query.select) : {};

            Task.findById(req.params.id).select(select).exec(function (err, task) {
                if (err) {
                    return res.status(500).json({
                        message: "Error retrieving task",
                        data: {}
                    });
                }
                if (!task) {
                    return res.status(404).json({
                        message: "Task not found",
                        data: {}
                    });
                }
                res.status(200).json({
                    message: "OK",
                    data: task
                });
            });
        } catch (err) {
            return res.status(400).json({
                message: "Bad request. Invalid query parameters",
                data: {}
            });
        }
    });

    // PUT /api/tasks/:id - Replace entire task
    router.put('/tasks/:id', function (req, res) {
        // Validate required fields
        if (!req.body.name || !req.body.deadline) {
            return res.status(400).json({
                message: "Name and deadline are required",
                data: {}
            });
        }

        Task.findById(req.params.id, function (err, task) {
            if (err) {
                return res.status(500).json({
                    message: "Error finding task",
                    data: {}
                });
            }
            if (!task) {
                return res.status(404).json({
                    message: "Task not found",
                    data: {}
                });
            }

            var oldAssignedUser = task.assignedUser;
            var oldCompleted = task.completed;

            // Update task fields
            task.name = req.body.name;
            task.description = req.body.description || "";
            task.deadline = req.body.deadline;
            task.completed = req.body.completed || false;
            task.assignedUser = req.body.assignedUser || "";
            task.assignedUserName = req.body.assignedUserName || "unassigned";

            task.save(function (err, updatedTask) {
                if (err) {
                    return res.status(500).json({
                        message: "Error updating task",
                        data: {}
                    });
                }

                // Handle two-way reference for assignedUser
                var taskId = updatedTask._id.toString();

                // Remove from old user's pendingTasks if user changed or task completed
                if (oldAssignedUser && oldAssignedUser !== "" && 
                    (oldAssignedUser !== updatedTask.assignedUser || updatedTask.completed)) {
                    User.findById(oldAssignedUser, function (err, user) {
                        if (!err && user) {
                            var index = user.pendingTasks.indexOf(taskId);
                            if (index > -1) {
                                user.pendingTasks.splice(index, 1);
                                user.save(function (err) {
                                    if (err) {
                                        console.log("Error removing task from old user:", err);
                                    }
                                });
                            }
                        }
                    });
                }

                // Add to new user's pendingTasks if user assigned and task not completed
                if (updatedTask.assignedUser && updatedTask.assignedUser !== "" && 
                    !updatedTask.completed && oldAssignedUser !== updatedTask.assignedUser) {
                    User.findById(updatedTask.assignedUser, function (err, user) {
                        if (!err && user) {
                            if (user.pendingTasks.indexOf(taskId) === -1) {
                                user.pendingTasks.push(taskId);
                                user.save(function (err) {
                                    if (err) {
                                        console.log("Error adding task to new user:", err);
                                    }
                                });
                            }
                        }
                    });
                }

                // If task was completed, remove from current user's pendingTasks
                if (updatedTask.completed && !oldCompleted && updatedTask.assignedUser && updatedTask.assignedUser !== "") {
                    User.findById(updatedTask.assignedUser, function (err, user) {
                        if (!err && user) {
                            var index = user.pendingTasks.indexOf(taskId);
                            if (index > -1) {
                                user.pendingTasks.splice(index, 1);
                                user.save(function (err) {
                                    if (err) {
                                        console.log("Error removing completed task from user:", err);
                                    }
                                });
                            }
                        }
                    });
                }

                res.status(200).json({
                    message: "Task updated successfully",
                    data: updatedTask
                });
            });
        });
    });

    // DELETE /api/tasks/:id - Delete a task
    router.delete('/tasks/:id', function (req, res) {
        Task.findByIdAndRemove(req.params.id, function (err, task) {
            if (err) {
                return res.status(500).json({
                    message: "Error deleting task",
                    data: {}
                });
            }
            if (!task) {
                return res.status(404).json({
                    message: "Task not found",
                    data: {}
                });
            }

            // Remove task from assignedUser's pendingTasks
            if (task.assignedUser && task.assignedUser !== "") {
                User.findById(task.assignedUser, function (err, user) {
                    if (!err && user) {
                        var index = user.pendingTasks.indexOf(task._id.toString());
                        if (index > -1) {
                            user.pendingTasks.splice(index, 1);
                            user.save(function (err) {
                                if (err) {
                                    console.log("Error removing task from user:", err);
                                }
                            });
                        }
                    }
                });
            }

            res.status(200).json({
                message: "Task deleted successfully",
                data: task
            });
        });
    });

    return router;
};