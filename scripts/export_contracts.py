import json
from pathlib import Path
from dentpro.main import app
from dentpro.contracts import ProposalInput
folder=Path('packages/contracts');folder.mkdir(exist_ok=True,parents=True)
(folder/'openapi.json').write_text(json.dumps(app.openapi(),indent=2)+'\n')
(folder/'proposal.schema.json').write_text(json.dumps(ProposalInput.model_json_schema(),indent=2)+'\n')
