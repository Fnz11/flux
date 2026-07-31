package cache

import "encoding/json"

// Values are serialized as JSON rather than protobuf: payloads are small DTOs,
// JSON needs no schema codegen or registry, and stored values stay readable in
// redis-cli for debugging. Protobuf only pays off at payloads large enough to
// matter and a team to maintain shared schemas — neither applies here.

func marshal(v any) ([]byte, error) {
	return json.Marshal(v)
}

func unmarshal(data []byte, dest any) error {
	return json.Unmarshal(data, dest)
}
