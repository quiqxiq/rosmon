package dto

import "github.com/quiqxiq/rosmon/store/model"

// QuickPrintPackageDTO adalah representasi wire untuk preset Quick Print.
// Semua field string (termasuk yang numeric) agar identik dengan
// web/src/features/voucher/print/api/schema.ts — frontend mem-parse sendiri.
type QuickPrintPackageDTO struct {
	Name         string `json:"name"          binding:"required,min=1,max=100"`
	Server       string `json:"server"`
	UserMode     string `json:"user_mode"`
	UserLength   string `json:"user_length"`
	Prefix       string `json:"prefix"`
	CharMode     string `json:"char_mode"`
	Profile      string `json:"profile"`
	TimeLimit    string `json:"time_limit"`
	DataLimit    string `json:"data_limit"`
	Comment      string `json:"comment"`
	Validity     string `json:"validity"`
	Price        string `json:"price"`
	SellingPrice string `json:"selling_price"`
	LockUser     string `json:"lock_user"`
}

// FromModelQuickPrint konversi model → DTO.
func FromModelQuickPrint(p model.QuickPrintPackage) QuickPrintPackageDTO {
	return QuickPrintPackageDTO{
		Name:         p.Name,
		Server:       p.Server,
		UserMode:     p.UserMode,
		UserLength:   p.UserLength,
		Prefix:       p.Prefix,
		CharMode:     p.CharMode,
		Profile:      p.Profile,
		TimeLimit:    p.TimeLimit,
		DataLimit:    p.DataLimit,
		Comment:      p.Comment,
		Validity:     p.Validity,
		Price:        p.Price,
		SellingPrice: p.SellingPrice,
		LockUser:     p.LockUser,
	}
}

// ToModel mengisi field model dari DTO (DeviceID & Name di-set oleh handler).
func (d QuickPrintPackageDTO) ToModel(deviceID uint) model.QuickPrintPackage {
	return model.QuickPrintPackage{
		DeviceID:     deviceID,
		Name:         d.Name,
		Server:       d.Server,
		UserMode:     d.UserMode,
		UserLength:   d.UserLength,
		Prefix:       d.Prefix,
		CharMode:     d.CharMode,
		Profile:      d.Profile,
		TimeLimit:    d.TimeLimit,
		DataLimit:    d.DataLimit,
		Comment:      d.Comment,
		Validity:     d.Validity,
		Price:        d.Price,
		SellingPrice: d.SellingPrice,
		LockUser:     d.LockUser,
	}
}
