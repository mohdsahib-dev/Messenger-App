const express = require("express");
const multer = require("multer");
const path = require("path");

const router = express.Router();

// ========================================
// MULTER STORAGE
// ========================================

const storage = multer.diskStorage({

    destination: (req, file, cb) => {

        cb(null, "uploads/");

    },

    filename: (req, file, cb) => {

        const uniqueName =
            Date.now() +
            "-" +
            Math.round(Math.random() * 1e9) +
            path.extname(file.originalname);

        cb(null, uniqueName);

    }

});

// ========================================
// MULTER CONFIGURATION
// ========================================

const upload = multer({

    storage: storage,

    limits: {

        // Maximum file size = 20 MB
        fileSize: 20 * 1024 * 1024

    }

});

// ========================================
// TEST ROUTE
// ========================================

router.get("/test", (req, res) => {

    res.status(200).json({

        success: true,

        message:
            "File route is working!"

    });

});

// ========================================
// FILE UPLOAD ROUTE
// ========================================

router.post(
    "/upload",
    upload.single("file"),

    (req, res) => {

        try {

            // ================================
            // CHECK FILE
            // ================================

            if (!req.file) {

                return res.status(400).json({

                    success: false,

                    message:
                        "No file uploaded"

                });

            }

            // ================================
            // FILE INFORMATION
            // ================================

            const fileData = {

                originalName:
                    req.file.originalname,

                fileName:
                    req.file.filename,

                fileType:
                    req.file.mimetype,

                fileSize:
                    req.file.size,

                fileUrl:
                    `/uploads/${req.file.filename}`

            };

            // ================================
            // RESPONSE
            // ================================

            return res.status(200).json({

                success: true,

                message:
                    "File uploaded successfully",

                file:
                    fileData

            });

        } catch (error) {

            console.error(
                "File upload error:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "File upload failed"

            });

        }

    }
);

// ========================================
// MULTER ERROR HANDLER
// ========================================

router.use(
    (error, req, res, next) => {

        if (
            error instanceof multer.MulterError
        ) {

            if (
                error.code ===
                "LIMIT_FILE_SIZE"
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "File size cannot exceed 20 MB"

                });

            }

        }

        console.error(
            "Upload error:",
            error
        );

        res.status(500).json({

            success: false,

            message:
                "Something went wrong during file upload"

        });

    }
);

// ========================================
// EXPORT ROUTER
// ========================================

module.exports = router;