package types

import (
	"encoding/json"
	"time"
)

// Timestamp is a custom time type that marshals to/from ISO 8601 format
type Timestamp time.Time

// MarshalJSON implements json.Marshaler for Timestamp
func (t Timestamp) MarshalJSON() ([]byte, error) {
	return json.Marshal(time.Time(t).Format(time.RFC3339))
}

// UnmarshalJSON implements json.Unmarshaler for Timestamp
func (t *Timestamp) UnmarshalJSON(data []byte) error {
	var s string
	if err := json.Unmarshal(data, &s); err != nil {
		return err
	}
	parsed, err := time.Parse(time.RFC3339, s)
	if err != nil {
		return err
	}
	*t = Timestamp(parsed)
	return nil
}

// Time returns the underlying time.Time value
func (t Timestamp) Time() time.Time {
	return time.Time(t)
}

// Now returns the current time as a Timestamp
func Now() Timestamp {
	return Timestamp(time.Now())
}

// String returns the timestamp as an ISO 8601 string
func (t Timestamp) String() string {
	return time.Time(t).Format(time.RFC3339)
}

// IsZero reports whether t represents the zero time instant
func (t Timestamp) IsZero() bool {
	return time.Time(t).IsZero()
}
