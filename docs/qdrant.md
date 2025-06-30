# Qdrant Configuration

picoLLM utilizes qdrant vector database for use of its comprehensive deterministic filtering as well as its prefetch methods. 

The production configuration can be found in `bld/qdrant/production.yml`

## Collection Building

The collection builder utilizes Huggingface datasets library to create collections. Essentially, you can chat with any Huggingface dataset that you want, including your local hf cache if you attach it to the container during the build. 

This was built for use with my US-LegalKit dataset, so there is some bias to legal documentation, but it will work so long as theres a field that can be signified as a document or text. This field can be anything you want, but all of the other fields that are not selected as the text field will be inferred as one of the other possible [payload types](https://qdrant.tech/documentation/concepts/payload/#payload-types) during [payload indexing](https://qdrant.tech/documentation/concepts/indexing/)

We also use the [sparse vector index](https://qdrant.tech/documentation/concepts/indexing/#sparse-vector-index) in this process due to the restraints of hybrid search. 