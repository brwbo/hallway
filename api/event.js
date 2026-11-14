import { endpoint } from "../lib/http.js";
import { eventPayload } from "../lib/dataset.js";

export default endpoint("GET", async () => eventPayload());
