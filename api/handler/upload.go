package handler

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/quiqxiq/rosmon/api/dto"
)

type Upload struct{}

func NewUpload() *Upload {
	return &Upload{}
}

func (h *Upload) UploadFile(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Err("BAD_REQUEST", "gagal membaca file", c.Request.URL.Path))
		return
	}

	// Validasi ekstensi/tipe file (JPEG, PNG, PDF)
	ext := filepath.Ext(file.Filename)
	switch ext {
	case ".jpg", ".jpeg", ".png", ".pdf", ".JPG", ".JPEG", ".PNG", ".PDF":
		// allowed
	default:
		c.JSON(http.StatusBadRequest, dto.Err("INVALID_ARGUMENT", "format file tidak didukung (harus JPG, JPEG, PNG, atau PDF)", c.Request.URL.Path))
		return
	}

	// Pastikan folder ./uploads ada
	if err := os.MkdirAll("./uploads", 0755); err != nil {
		c.JSON(http.StatusInternalServerError, dto.Err("INTERNAL", "gagal membuat folder penyimpanan: "+err.Error(), c.Request.URL.Path))
		return
	}

	// Generate nama file unik dengan UUID
	filename := fmt.Sprintf("%d-%s%s", time.Now().Unix(), uuid.New().String(), ext)
	dst := filepath.Join("./uploads", filename)

	if err := c.SaveUploadedFile(file, dst); err != nil {
		c.JSON(http.StatusInternalServerError, dto.Err("INTERNAL", "gagal menyimpan file: "+err.Error(), c.Request.URL.Path))
		return
	}

	WriteCreated(c, gin.H{
		"url": "/uploads/" + filename,
	})
}
