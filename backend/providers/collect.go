package providers

import (
	"context"
	"fmt"
	"strings"
)

// CollectStreamText consumes all StreamChunks from a channel and returns the
// concatenated text content. It handles ChunkTypeError and context cancellation.
func CollectStreamText(ctx context.Context, chunks <-chan StreamChunk) (string, error) {
	var b strings.Builder

	for {
		select {
		case <-ctx.Done():
			return b.String(), ctx.Err()
		case chunk, ok := <-chunks:
			if !ok {
				return b.String(), nil
			}
			switch chunk.Type {
			case ChunkTypeError:
				return b.String(), fmt.Errorf("provider error: %s", chunk.Content)
			case ChunkTypeChunk:
				b.WriteString(chunk.Content)
			}
		}
	}
}
