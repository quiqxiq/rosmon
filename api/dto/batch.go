package dto

// BatchDeleteUintRequest payload untuk bulk delete dengan ID integer (uint).
type BatchDeleteUintRequest struct {
	IDs []uint `json:"ids" binding:"required,min=1"`
}

// BatchDeleteStringRequest payload untuk bulk delete dengan ID string (misal RouterOS ID "*1", "*2").
type BatchDeleteStringRequest struct {
	IDs []string `json:"ids" binding:"required,min=1"`
}

// BatchDeleteResponse response standar untuk hasil batch delete.
type BatchDeleteResponse struct {
	Deleted int64 `json:"deleted"`
}
