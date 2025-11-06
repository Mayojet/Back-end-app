var User = require('../models/user');
var Task = require('../models/task');

module.exports = function (router) {

    // GET /api/users - Get all users with query parameters
    router.get('/users', function (req, res) {
        try {
            // Parse query parameters
            var where = req.query.where ? JSON.parse(req.query.where) : {};
            var sort = req.query.sort ? JSON.parse(req.query.sort) : {};
            var select = req.query.select ? JSON.parse(req.query.select) : {};
            var skip = req.query.skip ? parseInt(req.query.skip) : 0;
            var limit = req.query.limit ? parseInt(req.query.limit) : 0; // 0 means no limit
            var count = req.query.count === 'true';

            // If count is requested, return count
            if (count) {
                User.countDocuments(where, function (err, count) {
                    if (err) {
                        return res.status(500).json({
                            message: "Error counting users",
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
                var query = User.find(where).sort(sort).select(select).skip(skip);
                
                if (limit > 0) {
                    query = query.limit(limit);
                }

                query.exec(function (err, users) {
                    if (err) {
                        return res.status(500).json({
                            message: "Error retrieving users",
                            data: {}
                        });
                    }
                    res.status(200).json({
                        message: "OK",
                        data: users
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

    // POST /api/users - Create a new user
    router.post('/users', function (req, res) {
        // Validate required fields
        if (!req.body.name || !req.body.email) {
            return res.status(400).json({
                message: "Name and email are required",
                data: {}
            });
        }

        var user = new User({
            name: req.body.name,
            email: req.body.email,
            pendingTasks: req.body.pendingTasks || []
        });

        user.save(function (err, savedUser) {
            if (err) {
                // Check for duplicate email error
                if (err.code === 11000) {
                    return res.status(400).json({
                        message: "User with this email already exists",
                        data: {}
                    });
                }
                return res.status(500).json({
                    message: "Error creating user",
                    data: {}
                });
            }

            // Update tasks if pendingTasks were provided
            if (req.body.pendingTasks && req.body.pendingTasks.length > 0) {
                Task.updateMany(
                    { _id: { $in: req.body.pendingTasks } },
                    { assignedUser: savedUser._id.toString(), assignedUserName: savedUser.name },
                    function (err) {
                        if (err) {
                            console.log("Error updating tasks:", err);
                        }
                    }
                );
            }

            res.status(201).json({
                message: "User created successfully",
                data: savedUser
            });
        });
    });

    // GET /api/users/:id - Get a specific user
    router.get('/users/:id', function (req, res) {
        try {
            var select = req.query.select ? JSON.parse(req.query.select) : {};

            User.findById(req.params.id).select(select).exec(function (err, user) {
                if (err) {
                    return res.status(500).json({
                        message: "Error retrieving user",
                        data: {}
                    });
                }
                if (!user) {
                    return res.status(404).json({
                        message: "User not found",
                        data: {}
                    });
                }
                res.status(200).json({
                    message: "OK",
                    data: user
                });
            });
        } catch (err) {
            return res.status(400).json({
                message: "Bad request. Invalid query parameters",
                data: {}
            });
        }
    });

    // PUT /api/users/:id - Replace entire user
    router.put('/users/:id', function (req, res) {
        // Validate required fields
        if (!req.body.name || !req.body.email) {
            return res.status(400).json({
                message: "Name and email are required",
                data: {}
            });
        }

        User.findById(req.params.id, function (err, user) {
            if (err) {
                return res.status(500).json({
                    message: "Error finding user",
                    data: {}
                });
            }
            if (!user) {
                return res.status(404).json({
                    message: "User not found",
                    data: {}
                });
            }

            var oldPendingTasks = user.pendingTasks || [];
            var newPendingTasks = req.body.pendingTasks || [];

            // Update user fields
            user.name = req.body.name;
            user.email = req.body.email;
            user.pendingTasks = newPendingTasks;

            user.save(function (err, updatedUser) {
                if (err) {
                    // Check for duplicate email error
                    if (err.code === 11000) {
                        return res.status(400).json({
                            message: "User with this email already exists",
                            data: {}
                        });
                    }
                    return res.status(500).json({
                        message: "Error updating user",
                        data: {}
                    });
                }

                // Handle two-way reference for pendingTasks
                // Unassign tasks that are no longer in pendingTasks
                var tasksToUnassign = oldPendingTasks.filter(function(taskId) {
                    return newPendingTasks.indexOf(taskId) === -1;
                });

                if (tasksToUnassign.length > 0) {
                    Task.updateMany(
                        { _id: { $in: tasksToUnassign } },
                        { assignedUser: "", assignedUserName: "unassigned" },
                        function (err) {
                            if (err) {
                                console.log("Error unassigning tasks:", err);
                            }
                        }
                    );
                }

                // Assign new tasks
                var tasksToAssign = newPendingTasks.filter(function(taskId) {
                    return oldPendingTasks.indexOf(taskId) === -1;
                });

                if (tasksToAssign.length > 0) {
                    Task.updateMany(
                        { _id: { $in: tasksToAssign } },
                        { assignedUser: updatedUser._id.toString(), assignedUserName: updatedUser.name },
                        function (err) {
                            if (err) {
                                console.log("Error assigning tasks:", err);
                            }
                        }
                    );
                }

                res.status(200).json({
                    message: "User updated successfully",
                    data: updatedUser
                });
            });
        });
    });

    // DELETE /api/users/:id - Delete a user
    router.delete('/users/:id', function (req, res) {
        User.findByIdAndRemove(req.params.id, function (err, user) {
            if (err) {
                return res.status(500).json({
                    message: "Error deleting user",
                    data: {}
                });
            }
            if (!user) {
                return res.status(404).json({
                    message: "User not found",
                    data: {}
                });
            }

            // Unassign all tasks that were assigned to this user
            if (user.pendingTasks && user.pendingTasks.length > 0) {
                Task.updateMany(
                    { _id: { $in: user.pendingTasks } },
                    { assignedUser: "", assignedUserName: "unassigned" },
                    function (err) {
                        if (err) {
                            console.log("Error unassigning tasks:", err);
                        }
                    }
                );
            }

            res.status(200).json({
                message: "User deleted successfully",
                data: user
            });
        });
    });

    return router;
};
