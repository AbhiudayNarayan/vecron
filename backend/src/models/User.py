from pydantic import BaseModel,Field,EmailStr
from typing import Union
from datetime import datetime
class User(BaseModel):
    name : str = Field( ...,description=" name is required")
    email : EmailStr = Field( ...,description=" email is required")
    password : str =  Field( ...,description=" password is required")

    # optional db field
    create_at : datetime = datetime.now()
    address : str=""
    mobile : str=""